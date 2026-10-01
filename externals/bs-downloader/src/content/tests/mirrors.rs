//! A depot spread over several CDN servers, each a local fixture that answers
//! its own way.

use super::*;

/// One file of `count` distinct chunks, with the routes that serve it.
fn game(count: usize) -> (Vec<Vec<u8>>, HashMap<String, Vec<u8>>) {
    let pieces: Vec<_> = (0..count)
        .map(|index| format!("chunk {index} of the game").into_bytes())
        .collect();
    let slices: Vec<&[u8]> = pieces.iter().map(Vec::as_slice).collect();
    let routes = routes(file("game.bin", &slices), &slices);
    (pieces, routes)
}

/// Grants `token` to every server that asks, recording each host.
struct Grant {
    token: Option<&'static str>,
    hosts: Mutex<Vec<String>>,
}

impl Grant {
    fn new(token: Option<&'static str>) -> Self {
        Self {
            token,
            hosts: Mutex::new(Vec::new()),
        }
    }
}

impl CdnAuthorization for Grant {
    fn token<'a>(&'a self, host: &'a str) -> BoxFuture<'a, Option<String>> {
        self.hosts.lock().unwrap().push(host.into());
        Box::pin(async move { self.token.map(Into::into) })
    }
}

#[tokio::test]
async fn a_depot_spreads_its_chunks_over_every_server_that_serves_it() {
    let directory = tempfile::tempdir().unwrap();
    let (pieces, routes) = game(24);
    let first = CdnFixture::new(routes.clone());
    let second = CdnFixture::new(routes);
    let client = serving(&[("first.cdn", &first), ("second.cdn", &second)]);
    client
        .download_depot(
            &plan_from(directory.path(), &["first.cdn", "second.cdn"]),
            &CancelToken::new(),
            |_| {},
        )
        .await
        .unwrap();
    assert_eq!(
        fs::read(directory.path().join("game.bin")).unwrap(),
        pieces.concat()
    );
    assert!(first.chunk_requests() > 0);
    assert!(second.chunk_requests() > 0);
    assert_eq!(first.chunk_requests() + second.chunk_requests(), 24);
}

#[tokio::test]
async fn a_failing_server_hands_its_requests_to_the_others() {
    let directory = tempfile::tempdir().unwrap();
    let (pieces, routes) = game(24);
    let failing = CdnFixture::answering(|_| (503, b"busy".to_vec(), Duration::ZERO));
    let healthy = CdnFixture::new(routes);
    let client = serving(&[("failing.cdn", &failing), ("healthy.cdn", &healthy)]);
    // Steam lists the failing server first: even the manifest moves on.
    client
        .download_depot(
            &plan_from(directory.path(), &["failing.cdn", "healthy.cdn"]),
            &CancelToken::new(),
            |_| {},
        )
        .await
        .unwrap();
    assert_eq!(
        fs::read(directory.path().join("game.bin")).unwrap(),
        pieces.concat()
    );
    // Three failures in a row retire it for the rest of the depot.
    assert!(failing.requests.lock().unwrap().len() <= 3);
}

#[tokio::test]
async fn a_lone_server_is_tried_again_after_a_failure() {
    let directory = tempfile::tempdir().unwrap();
    let (pieces, routes) = game(4);
    let answered = std::sync::atomic::AtomicUsize::new(0);
    let fixture = CdnFixture::answering(move |path| {
        // Every third request, the manifest's first among them, meets a
        // transient failure.
        if answered.fetch_add(1, Ordering::Relaxed).is_multiple_of(3) {
            return (503, b"busy".to_vec(), Duration::ZERO);
        }
        let bytes = routes.get(path).cloned().unwrap_or_default();
        (200, bytes, Duration::ZERO)
    });
    fixture
        .client()
        .download_depot(&plan(directory.path()), &CancelToken::new(), |_| {})
        .await
        .unwrap();
    assert_eq!(
        fs::read(directory.path().join("game.bin")).unwrap(),
        pieces.concat()
    );
}

#[tokio::test]
async fn an_unreachable_or_corrupt_server_does_not_fail_the_depot() {
    let directory = tempfile::tempdir().unwrap();
    let (pieces, routes) = game(12);
    let corrupt = CdnFixture::answering({
        let routes = routes.clone();
        move |path| {
            let mut bytes = routes.get(path).cloned().unwrap_or_default();
            if path.contains("/chunk/") {
                bytes.truncate(bytes.len() / 2);
            }
            (200, bytes, Duration::ZERO)
        }
    });
    let healthy = CdnFixture::new(routes);
    let client = serving(&[("corrupt.cdn", &corrupt), ("healthy.cdn", &healthy)]);
    client
        .download_depot(
            &plan_from(
                directory.path(),
                &["unreachable.cdn", "corrupt.cdn", "healthy.cdn"],
            ),
            &CancelToken::new(),
            |_| {},
        )
        .await
        .unwrap();
    assert_eq!(
        fs::read(directory.path().join("game.bin")).unwrap(),
        pieces.concat()
    );
}

#[tokio::test]
async fn a_corrupt_manifest_moves_to_another_server() {
    let directory = tempfile::tempdir().unwrap();
    let (pieces, routes) = game(4);
    let corrupt = CdnFixture::answering(|_| (200, b"bad manifest".to_vec(), Duration::ZERO));
    let healthy = CdnFixture::new(routes);
    let client = serving(&[("corrupt.cdn", &corrupt), ("healthy.cdn", &healthy)]);
    client
        .download_depot(
            &plan_from(directory.path(), &["corrupt.cdn", "healthy.cdn"]),
            &CancelToken::new(),
            |_| {},
        )
        .await
        .unwrap();
    assert_eq!(
        fs::read(directory.path().join("game.bin")).unwrap(),
        pieces.concat()
    );
    assert!(!corrupt.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn a_server_that_refuses_the_depot_serves_it_once_authorized() {
    let directory = tempfile::tempdir().unwrap();
    let (pieces, routes) = game(4);
    let fixture = CdnFixture::answering(move |target| {
        let (path, query) = target.split_once('?').unwrap_or((target, ""));
        match routes.get(path) {
            Some(bytes) if query == "token=granted" => (200, bytes.clone(), Duration::ZERO),
            _ => (403, b"forbidden".to_vec(), Duration::ZERO),
        }
    });
    let grant = Grant::new(Some("?token=granted"));
    let mut plan = plan(directory.path());
    plan.authorization = Some(&grant);
    fixture
        .client()
        .download_depot(&plan, &CancelToken::new(), |_| {})
        .await
        .unwrap();
    assert_eq!(
        fs::read(directory.path().join("game.bin")).unwrap(),
        pieces.concat()
    );
    assert_eq!(*grant.hosts.lock().unwrap(), [CDN_HOST]);
}

#[tokio::test]
async fn a_depot_every_server_refuses_fails_as_forbidden() {
    let directory = tempfile::tempdir().unwrap();
    let refuse = || CdnFixture::answering(|_| (403, b"forbidden".to_vec(), Duration::ZERO));
    let (first, second) = (refuse(), refuse());
    let client = serving(&[("first.cdn", &first), ("second.cdn", &second)]);
    // Each server gets one token; refusing it too retires the server.
    let grant = Grant::new(Some("token=refused"));
    let mut plan = plan_from(directory.path(), &["first.cdn", "second.cdn"]);
    plan.authorization = Some(&grant);
    let result = client
        .download_depot(&plan, &CancelToken::new(), |_| {})
        .await;
    assert!(matches!(result, Err(ContentError::Http(403))));
    assert_eq!(*grant.hosts.lock().unwrap(), ["first.cdn", "second.cdn"]);
    // Without authorization, the first refusal is final.
    plan.authorization = None;
    let result = client
        .download_depot(&plan, &CancelToken::new(), |_| {})
        .await;
    assert!(matches!(result, Err(ContentError::Http(403))));
}

#[tokio::test]
async fn a_chunk_every_server_reports_missing_fails_the_depot() {
    let directory = tempfile::tempdir().unwrap();
    let (_, mut routes) = game(1);
    routes.retain(|path, _| !path.contains("/chunk/"));
    let first = CdnFixture::new(routes.clone());
    let second = CdnFixture::new(routes);
    let client = serving(&[("first.cdn", &first), ("second.cdn", &second)]);
    let result = client
        .download_depot(
            &plan_from(directory.path(), &["first.cdn", "second.cdn"]),
            &CancelToken::new(),
            |_| {},
        )
        .await;
    assert!(matches!(result, Err(ContentError::Http(404))));
    assert_eq!(first.chunk_requests() + second.chunk_requests(), 2);
}

#[tokio::test]
async fn a_chunk_missing_on_two_servers_is_still_tried_on_the_remaining_server() {
    let directory = tempfile::tempdir().unwrap();
    let (pieces, routes) = game(1);
    let mut missing_routes = routes.clone();
    missing_routes.retain(|path, _| !path.contains("/chunk/"));
    let first = CdnFixture::new(missing_routes.clone());
    let second = CdnFixture::new(missing_routes);
    let third = CdnFixture::new(routes);
    let client = serving(&[
        ("first.cdn", &first),
        ("second.cdn", &second),
        ("third.cdn", &third),
    ]);
    client
        .download_depot(
            &plan_from(directory.path(), &["first.cdn", "second.cdn", "third.cdn"]),
            &CancelToken::new(),
            |_| {},
        )
        .await
        .unwrap();
    assert_eq!(
        fs::read(directory.path().join("game.bin")).unwrap(),
        pieces.concat()
    );
    assert_eq!(third.chunk_requests(), 1);
}

#[tokio::test]
async fn concurrent_refusals_renew_each_token_once() {
    use futures_util::{StreamExt, stream::FuturesUnordered};

    let plan = plan(Path::new("unused"));
    let grant = Grant::new(Some("token=granted"));
    let mirrors = Mirrors::new(&plan.servers, Some(&grant)).unwrap();
    let cancel = CancelToken::new();
    // Measure the server so it can take eight requests at once.
    mirrors
        .fetch("manifest", None, 1, &cancel, |_| async { Ok(((), 1)) })
        .await
        .unwrap();
    let simultaneous = tokio::sync::Barrier::new(8);
    let mut requests: FuturesUnordered<_> = (0..8)
        .map(|index| {
            let mirrors = &mirrors;
            let cancel = &cancel;
            let simultaneous = &simultaneous;
            async move {
                mirrors
                    .fetch("chunk", None, 1, cancel, |url| async move {
                        if url.query() == Some("token=granted") {
                            return Ok(((), 1));
                        }
                        simultaneous.wait().await;
                        if index > 0 {
                            // These refusals arrive after the new token has already worked.
                            tokio::time::sleep(Duration::from_millis(50)).await;
                        }
                        Err(ContentError::Http(401))
                    })
                    .await
            }
        })
        .collect();
    tokio::time::timeout(Duration::from_secs(2), async {
        while let Some(result) = requests.next().await {
            result.unwrap();
        }
    })
    .await
    .unwrap();
    assert_eq!(*grant.hosts.lock().unwrap(), [CDN_HOST]);
}

#[tokio::test]
async fn an_expired_cdn_token_is_renewed_after_serving_content() {
    use std::sync::atomic::AtomicUsize;

    struct RenewingGrant(AtomicUsize);
    impl CdnAuthorization for RenewingGrant {
        fn token<'a>(&'a self, _: &'a str) -> BoxFuture<'a, Option<String>> {
            let generation = self.0.fetch_add(1, Ordering::Relaxed) + 1;
            Box::pin(async move { Some(format!("token={generation}")) })
        }
    }

    let plan = plan(Path::new("unused"));
    let grant = RenewingGrant(AtomicUsize::new(0));
    let mirrors = Mirrors::new(&plan.servers, Some(&grant)).unwrap();
    let cancel = CancelToken::new();
    for generation in 1..=2 {
        let expected = format!("token={generation}");
        mirrors
            .fetch("chunk", None, 1, &cancel, |url| {
                let accepted = url.query() == Some(expected.as_str());
                async move {
                    if accepted {
                        Ok(((), 1))
                    } else {
                        Err(ContentError::Http(403))
                    }
                }
            })
            .await
            .unwrap();
    }
    assert_eq!(grant.0.load(Ordering::Relaxed), 2);
}

#[tokio::test]
async fn cdn_tokens_are_requested_for_each_authorization_host() {
    let directory = tempfile::tempdir().unwrap();
    let (pieces, routes) = game(24);
    let protected = || {
        let routes = routes.clone();
        CdnFixture::answering(move |target| {
            let (path, query) = target.split_once('?').unwrap_or((target, ""));
            if query == "token=granted" {
                (200, routes.get(path).unwrap().clone(), Duration::ZERO)
            } else {
                (403, b"forbidden".to_vec(), Duration::ZERO)
            }
        })
    };
    let (first, second) = (protected(), protected());
    let client = serving(&[("first.cdn", &first), ("second.cdn", &second)]);
    let grant = Grant::new(Some("token=granted"));
    let mut plan = plan_from(directory.path(), &["first.cdn", "second.cdn"]);
    plan.servers[0].host = "first.auth".into();
    plan.servers[1].host = "second.auth".into();
    plan.authorization = Some(&grant);
    client
        .download_depot(&plan, &CancelToken::new(), |_| {})
        .await
        .unwrap();
    assert_eq!(
        fs::read(directory.path().join("game.bin")).unwrap(),
        pieces.concat()
    );
    let mut hosts = grant.hosts.lock().unwrap().clone();
    hosts.sort();
    assert_eq!(hosts, ["first.auth", "second.auth"]);
    assert!(first.chunk_requests() > 0 && second.chunk_requests() > 0);
}

#[tokio::test]
async fn a_slow_manifest_is_raced_on_another_server() {
    let directory = tempfile::tempdir().unwrap();
    let (pieces, routes) = game(4);
    let slow = CdnFixture::answering(|_| (200, Vec::new(), Duration::from_secs(60)));
    let fast = CdnFixture::new(routes);
    let client = serving(&[("slow.cdn", &slow), ("fast.cdn", &fast)]);
    tokio::time::timeout(
        Duration::from_secs(10),
        client.download_depot(
            &plan_from(directory.path(), &["slow.cdn", "fast.cdn"]),
            &CancelToken::new(),
            |_| {},
        ),
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(
        fs::read(directory.path().join("game.bin")).unwrap(),
        pieces.concat()
    );
    assert!(!slow.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn a_chunk_the_writer_waits_on_is_raced_on_a_faster_server() {
    let directory = tempfile::tempdir().unwrap();
    let (pieces, routes) = game(24);
    // A busy server: it answers the manifest at once, then holds every chunk.
    let slow = CdnFixture::answering({
        let routes = routes.clone();
        move |path| {
            let delay = if path.contains("/chunk/") {
                Duration::from_secs(60)
            } else {
                Duration::ZERO
            };
            let bytes = routes.get(path).cloned().unwrap_or_default();
            (200, bytes, delay)
        }
    });
    let fast = CdnFixture::new(routes);
    let client = serving(&[("slow.cdn", &slow), ("fast.cdn", &fast)]);
    let started = Instant::now();
    client
        .download_depot(
            &plan_from(directory.path(), &["slow.cdn", "fast.cdn"]),
            &CancelToken::new(),
            |_| {},
        )
        .await
        .unwrap();
    assert!(
        started.elapsed() < Duration::from_secs(20),
        "chunks held by the busy server must come from the fast one"
    );
    assert_eq!(
        fs::read(directory.path().join("game.bin")).unwrap(),
        pieces.concat()
    );
    assert!(slow.chunk_requests() > 0, "the busy server was measured");
}
