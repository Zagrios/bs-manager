//! The CDN servers one depot download spreads its requests over.
//!
//! CDN response speeds vary, including among the servers Steam prefers. A
//! depot keeps requests in flight across every server allowed to serve it,
//! measures each
//! server, and sends every request to the fastest one with room. A failed
//! request moves to another server, and one of the oldest unfinished requests
//! that runs long is raced on another server: the first answer wins.

use std::{
    collections::BTreeSet,
    future::Future,
    sync::{Mutex, MutexGuard, PoisonError},
    time::{Duration, Instant},
};

use futures_util::{StreamExt, stream::FuturesUnordered};
use reqwest::Url;
use tokio::sync::Notify;

use super::{CancelToken, CdnAuthorization, ContentError, invalid};
use crate::cm::ContentServer;

/// Requests one server takes at once, so a depot spreads over several.
const SERVER_REQUESTS: usize = 8;
/// Consecutive failed requests after which a server rests: a lost network
/// fails every server at once, and each must be tried again once it returns.
const SERVER_FAILURES: u32 = 3;
const SERVER_REST: Duration = Duration::from_secs(10);
/// Tokens one server is granted: an expired token is renewed, but a server
/// that keeps refusing is dropped.
const SERVER_AUTHORIZATIONS: u8 = 3;
/// Failed attempts after which a request fails its depot. Each waits twice as
/// long as the one before, so a brief network loss is ridden out.
const REQUEST_ATTEMPTS: u32 = 5;
const RETRY_DELAY: Duration = Duration::from_millis(250);
/// How many of the oldest unfinished requests may be raced: their files stay
/// open, holding up the files prepared after them.
const RACED_REQUESTS: usize = 8;
/// Races one request may run beside its first attempt.
const RACES: usize = 2;
/// A request is raced once it runs this many typical requests, and never
/// sooner than the floor.
const RACE_FACTOR: f64 = 3.0;
const RACE_FLOOR: Duration = Duration::from_secs(1);
/// When a request is raced before any chunk request has completed.
const RACE_START: Duration = Duration::from_secs(2);
/// How often a long request that may not be raced yet looks again.
const RACE_CHECK: Duration = Duration::from_millis(250);
/// Weight of a new sample in a server's speed and in the typical request.
const SMOOTHING: f64 = 0.3;

/// The servers of one depot, the requests they share and what each has shown.
pub(super) struct Mirrors<'a> {
    addresses: Vec<Address>,
    authorization: Option<&'a dyn CdnAuthorization>,
    state: Mutex<State>,
    /// Wakes requests waiting for room whenever a server's room or standing
    /// changes.
    changed: Notify,
}

struct Address {
    /// Where requests go: `https://{vhost}/`.
    base: Url,
    /// The host Steam authorizes requests for.
    host: String,
}

struct State {
    servers: Vec<Server>,
    next_ticket: u64,
    /// Tickets of the requests not finished yet, oldest first.
    unfinished: BTreeSet<u64>,
    /// Seconds a chunk request typically takes, once one has completed.
    typical: Option<f64>,
}

#[derive(Default)]
struct Server {
    token: Option<String>,
    in_flight: usize,
    /// Bytes per second one request receives, once measured.
    speed: Option<f64>,
    /// Consecutive failed requests.
    failures: u32,
    authorizing: bool,
    authorizations: u8,
    /// The current token served a request: a later refusal means it expired.
    token_served: bool,
    /// After consecutive failures, the server takes no request until then.
    resting_until: Option<Instant>,
    /// The status with which the server refused the depot for good.
    refused: Option<u16>,
}

impl Server {
    /// An unmeasured server, or one that just failed, takes a single request
    /// until it answers one.
    fn room(&self) -> usize {
        if self.speed.is_none() || self.failures > 0 {
            1
        } else {
            SERVER_REQUESTS
        }
    }

    /// Unmeasured servers come first, so each is measured once.
    fn preference(&self) -> f64 {
        match self.speed {
            Some(speed) => speed,
            None if self.failures > 0 => 0.0,
            None => f64::INFINITY,
        }
    }

    fn measure(&mut self, speed: f64) {
        self.speed = Some(
            self.speed
                .map_or(speed, |old| old + SMOOTHING * (speed - old)),
        );
    }
}

enum Pick {
    Granted(usize, Option<String>, u8),
    /// Until room frees, or a resting server may be tried again.
    Wait(Option<Instant>),
    Exhausted,
}

impl State {
    /// Takes room on the fastest server outside `avoid`. A race takes room on
    /// a measured server faster than the speed it must `beat`, or else on one
    /// not tried yet.
    fn take(&mut self, avoid: &[usize], beat: Option<f64>) -> Pick {
        let now = Instant::now();
        let mut wait = false;
        let mut rested: Option<Instant> = None;
        let mut best: Option<(usize, f64)> = None;
        for (index, server) in self.servers.iter().enumerate() {
            if server.refused.is_some() || avoid.contains(&index) {
                continue;
            }
            if let Some(until) = server.resting_until.filter(|until| *until > now) {
                rested = Some(rested.map_or(until, |earliest| earliest.min(until)));
                continue;
            }
            if server.authorizing || server.in_flight >= server.room() {
                wait = true;
                continue;
            }
            let preference = match beat {
                None => server.preference(),
                Some(_) if server.failures > 0 => continue,
                Some(beat) => match server.speed {
                    Some(speed) if speed > beat => speed,
                    Some(_) => continue,
                    None => 0.0,
                },
            };
            if best.is_none_or(|(_, top)| preference > top) {
                best = Some((index, preference));
            }
        }
        match best {
            Some((index, _)) => {
                let server = &mut self.servers[index];
                server.in_flight += 1;
                Pick::Granted(index, server.token.clone(), server.authorizations)
            }
            None if wait || rested.is_some() => Pick::Wait(rested),
            None => Pick::Exhausted,
        }
    }
}

impl<'a> Mirrors<'a> {
    /// `servers` in Steam's order of preference; `authorization` grants the
    /// tokens they may require.
    pub(super) fn new(
        servers: &[ContentServer],
        authorization: Option<&'a dyn CdnAuthorization>,
    ) -> Result<Self, ContentError> {
        let addresses: Vec<_> = servers
            .iter()
            .filter_map(|server| {
                // CM supplies hosts, not arbitrary URLs. Prevent credentials/query injection.
                if server.vhost.is_empty() || server.vhost.contains(['/', '?', '#', '@', '\\']) {
                    return None;
                }
                let base = Url::parse(&format!("https://{}/", server.vhost)).ok()?;
                Some(Address {
                    base,
                    host: server.host.clone(),
                })
            })
            .collect();
        if addresses.is_empty() {
            return Err(invalid("steam.content.invalidCdnAddress"));
        }
        let servers = addresses.iter().map(|_| Server::default()).collect();
        Ok(Self {
            addresses,
            authorization,
            state: Mutex::new(State {
                servers,
                next_ticket: 0,
                unfinished: BTreeSet::new(),
                typical: None,
            }),
            changed: Notify::new(),
        })
    }

    /// Places a request in the order the writer needs requests answered: the
    /// manifest, then chunks as the writer requests them. The ticket leaves
    /// that order once its request finishes.
    pub(super) fn ticket(&self) -> Ticket<'_> {
        let mut state = self.lock();
        let order = state.next_ticket;
        state.next_ticket += 1;
        state.unfinished.insert(order);
        Ticket {
            mirrors: self,
            order,
        }
    }

    /// Fetches `path` through the fastest server with room, moving to another
    /// server after a failure. A request whose `ticket` is among the oldest
    /// unfinished ones is raced on another server once it runs long; the
    /// first answer wins. `request` fetches one URL and returns its value with
    /// the bytes received; `expected` estimates those bytes up front, or is
    /// zero when unknown.
    pub(super) async fn fetch<T, F>(
        &self,
        path: &str,
        ticket: Option<&Ticket<'_>>,
        expected: u64,
        cancel: &CancelToken,
        request: impl Fn(Url) -> F,
    ) -> Result<(T, u64), ContentError>
    where
        F: Future<Output = Result<(T, u64), ContentError>>,
    {
        let mut tried = Vec::new();
        let mut failures = 0;
        let mut missing = Vec::new();
        let mut last_error = None;
        let mut running = FuturesUnordered::new();
        // Servers running this request and when each started; a race runs
        // against the latest.
        let mut busy: Vec<(usize, Instant)> = Vec::new();
        let mut race_at = Instant::now();
        loop {
            if running.is_empty() {
                if failures > 0 {
                    tokio::select! {
                        () = tokio::time::sleep(RETRY_DELAY * 2_u32.pow(failures - 1)) => {}
                        () = cancel.cancelled() => return Err(ContentError::Cancelled),
                    }
                }
                let lease = loop {
                    match self.lease(path, &tried, expected, cancel).await? {
                        Some(lease) => break lease,
                        // Every server left failed this request: try them again.
                        None if !tried.is_empty() => tried.clear(),
                        None => return Err(last_error.unwrap_or_else(|| self.exhausted())),
                    }
                };
                race_at = lease.started + self.race_after();
                busy.push((lease.server, lease.started));
                running.push(send(lease, &request));
            }
            let raceable = ticket.is_some() && running.len() <= RACES;
            tokio::select! {
                Some((lease, result)) = running.next() => {
                    let server = lease.server;
                    let authorization = lease.authorization;
                    busy.retain(|(other, _)| *other != server);
                    match result {
                        Ok((value, received)) => {
                            lease.settle(Outcome::Served(received));
                            return Ok((value, received));
                        }
                        Err(ContentError::Cancelled) => return Err(ContentError::Cancelled),
                        Err(ContentError::Http(code @ (401 | 403))) => {
                            lease.settle(Outcome::Refused);
                            if !self.authorize(server, code, authorization, cancel).await? {
                                tried.push(server);
                            }
                            last_error = Some(ContentError::Http(code));
                        }
                        Err(error) => {
                            lease.settle(Outcome::Failed);
                            tried.push(server);
                            if matches!(error, ContentError::Http(404)) {
                                if !missing.contains(&server) { missing.push(server); }
                            } else {
                                failures += 1;
                            }
                            let all_missing = self.lock().servers.iter().enumerate()
                                .filter(|(_, server)| server.refused.is_none())
                                .all(|(index, _)| missing.contains(&index));
                            if all_missing || failures >= REQUEST_ATTEMPTS {
                                return Err(error);
                            }
                            last_error = Some(error);
                        }
                    }
                }
                () = tokio::time::sleep_until(race_at.into()), if raceable => {
                    race_at = Instant::now() + RACE_CHECK;
                    if ticket.is_some_and(|ticket| self.urgent(ticket)) {
                        let avoid: Vec<_> = tried
                            .iter()
                            .copied()
                            .chain(busy.iter().map(|(server, _)| *server))
                            .collect();
                        let (raced, started) = busy[busy.len() - 1];
                        if let Some(lease) = self.race(path, &avoid, raced, started, expected) {
                            race_at = lease.started + self.race_after();
                            busy.push((lease.server, lease.started));
                            running.push(send(lease, &request));
                        }
                    }
                }
                () = cancel.cancelled() => return Err(ContentError::Cancelled),
            }
        }
    }

    /// Waits for room on a server outside `avoid`; `None` when every other
    /// server refused the depot.
    async fn lease(
        &self,
        path: &str,
        avoid: &[usize],
        expected: u64,
        cancel: &CancelToken,
    ) -> Result<Option<Lease<'_>>, ContentError> {
        loop {
            let changed = self.changed.notified();
            tokio::pin!(changed);
            changed.as_mut().enable();
            let pick = self.lock().take(avoid, None);
            let rested = match pick {
                Pick::Granted(server, token, authorization) => {
                    return Ok(Some(self.grant(
                        server,
                        token,
                        authorization,
                        path,
                        expected,
                    )));
                }
                Pick::Exhausted => return Ok(None),
                Pick::Wait(rested) => rested,
            };
            let rest = tokio::time::sleep_until(rested.unwrap_or(Instant::now()).into());
            tokio::select! {
                () = &mut changed => {}
                () = rest, if rested.is_some() => {}
                () = cancel.cancelled() => return Err(ContentError::Cancelled),
            }
        }
    }

    /// Room for a race against the request running on `raced` since
    /// `started`, if a faster server has some. The running request already
    /// shows its server at most this fast.
    fn race(
        &self,
        path: &str,
        avoid: &[usize],
        raced: usize,
        started: Instant,
        expected: u64,
    ) -> Option<Lease<'_>> {
        let shown = expected as f64 / started.elapsed().as_secs_f64().max(0.001);
        let mut state = self.lock();
        let beat = state.servers[raced]
            .speed
            .map_or(shown, |speed| speed.min(shown));
        let pick = state.take(avoid, Some(beat));
        drop(state);
        match pick {
            Pick::Granted(server, token, authorization) => {
                Some(self.grant(server, token, authorization, path, expected))
            }
            Pick::Wait(_) | Pick::Exhausted => None,
        }
    }

    fn grant(
        &self,
        server: usize,
        token: Option<String>,
        authorization: u8,
        path: &str,
        expected: u64,
    ) -> Lease<'_> {
        let mut url = self.addresses[server].base.clone();
        url.set_path(path);
        url.set_query(token.as_deref().map(|token| token.trim_start_matches('?')));
        Lease {
            mirrors: self,
            server,
            url,
            expected,
            authorization,
            started: Instant::now(),
            settled: false,
        }
    }

    /// After `server` refused a request: asks for a token when the server has
    /// none or its token expired, and drops a server that refuses a token.
    /// Returns whether the server may take the request again.
    async fn authorize(
        &self,
        server: usize,
        code: u16,
        generation: u8,
        cancel: &CancelToken,
    ) -> Result<bool, ContentError> {
        let authorization = {
            let mut state = self.lock();
            let entry = &mut state.servers[server];
            if entry.refused.is_some() {
                return Ok(false);
            }
            // Another request already renewed the token this request used.
            if entry.authorizing || entry.authorizations != generation {
                return Ok(true);
            }
            match self.authorization {
                Some(authorization)
                    if (entry.token.is_none() || entry.token_served)
                        && entry.authorizations < SERVER_AUTHORIZATIONS =>
                {
                    entry.authorizing = true;
                    entry.authorizations += 1;
                    authorization
                }
                _ => {
                    entry.refused = Some(code);
                    drop(state);
                    self.changed.notify_waiters();
                    return Ok(false);
                }
            }
        };
        let token = tokio::select! {
            token = authorization.token(&self.addresses[server].host) => token,
            () = cancel.cancelled() => return Err(ContentError::Cancelled),
        };
        let granted = token.is_some();
        {
            let mut state = self.lock();
            let entry = &mut state.servers[server];
            entry.authorizing = false;
            match token {
                Some(token) => {
                    entry.token = Some(token);
                    entry.token_served = false;
                }
                None => entry.refused = Some(code),
            }
        }
        self.changed.notify_waiters();
        Ok(granted)
    }

    /// Why no server remains: every server refused the depot.
    fn exhausted(&self) -> ContentError {
        self.lock()
            .servers
            .iter()
            .find_map(|server| server.refused)
            .map_or(ContentError::Network, ContentError::Http)
    }

    fn race_after(&self) -> Duration {
        self.lock().typical.map_or(RACE_START, |typical| {
            RACE_FLOOR.max(Duration::from_secs_f64(typical * RACE_FACTOR))
        })
    }

    /// Few unfinished requests are older than the ticket's: its file holds up
    /// the files prepared after it.
    fn urgent(&self, ticket: &Ticket<'_>) -> bool {
        self.lock()
            .unfinished
            .range(..ticket.order)
            .nth(RACED_REQUESTS - 1)
            .is_none()
    }

    fn lock(&self) -> MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

/// A chunk request's place in the order the writer consumes chunks.
pub(super) struct Ticket<'m> {
    mirrors: &'m Mirrors<'m>,
    order: u64,
}

impl Drop for Ticket<'_> {
    fn drop(&mut self) {
        self.mirrors.lock().unfinished.remove(&self.order);
    }
}

/// Room on one server for one request. Dropped unsettled, its request was
/// abandoned.
struct Lease<'m> {
    mirrors: &'m Mirrors<'m>,
    server: usize,
    url: Url,
    expected: u64,
    /// Token generation used by this request, before any concurrent renewal.
    authorization: u8,
    started: Instant,
    settled: bool,
}

enum Outcome {
    Served(u64),
    Failed,
    Refused,
    Abandoned,
}

impl Lease<'_> {
    fn settle(mut self, outcome: Outcome) {
        self.record(outcome);
    }

    fn record(&mut self, outcome: Outcome) {
        if std::mem::replace(&mut self.settled, true) {
            return;
        }
        let elapsed = self.started.elapsed().as_secs_f64().max(0.001);
        let mut state = self.mirrors.lock();
        if matches!(outcome, Outcome::Served(_)) && self.expected > 0 {
            state.typical = Some(
                state
                    .typical
                    .map_or(elapsed, |typical| typical + SMOOTHING * (elapsed - typical)),
            );
        }
        let server = &mut state.servers[self.server];
        server.in_flight -= 1;
        match outcome {
            Outcome::Served(received) => {
                server.measure(received as f64 / elapsed);
                server.failures = 0;
                if self.authorization == server.authorizations {
                    server.token_served |= server.token.is_some();
                }
            }
            Outcome::Failed => {
                server.failures += 1;
                server.speed = server.speed.map(|speed| speed / 2.0);
                if server.failures >= SERVER_FAILURES {
                    server.resting_until = Some(Instant::now() + SERVER_REST);
                }
            }
            // A request abandoned for a faster answer would have taken longer.
            Outcome::Abandoned if self.expected > 0 => {
                let bound = self.expected as f64 / elapsed;
                if server.speed.is_none_or(|speed| bound < speed) {
                    server.measure(bound);
                }
            }
            Outcome::Abandoned | Outcome::Refused => {}
        }
        drop(state);
        self.mirrors.changed.notify_waiters();
    }
}

impl Drop for Lease<'_> {
    fn drop(&mut self) {
        self.record(Outcome::Abandoned);
    }
}

async fn send<'m, T, F>(
    lease: Lease<'m>,
    request: &impl Fn(Url) -> F,
) -> (Lease<'m>, Result<(T, u64), ContentError>)
where
    F: Future<Output = Result<(T, u64), ContentError>>,
{
    let result = request(lease.url.clone()).await;
    (lease, result)
}
