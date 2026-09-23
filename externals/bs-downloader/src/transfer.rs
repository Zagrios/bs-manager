use std::{
    future::Future,
    sync::{
        Arc, Mutex, PoisonError,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
};

use futures_util::{StreamExt, stream};
use tokio::sync::{Notify, mpsc};
#[derive(Clone, Debug, Default)]
pub struct CancelToken(Arc<CancelState>);

#[derive(Debug, Default)]
struct CancelState {
    cancelled: AtomicBool,
    notify: Notify,
    workers: AtomicUsize,
    workers_finished: Notify,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Cancelled;

impl CancelToken {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn cancel(&self) {
        self.0.cancelled.store(true, Ordering::Release);
        self.0.notify.notify_waiters();
    }

    pub fn is_cancelled(&self) -> bool {
        self.0.cancelled.load(Ordering::Acquire)
    }

    pub fn check(&self) -> Result<(), Cancelled> {
        if self.is_cancelled() {
            Err(Cancelled)
        } else {
            Ok(())
        }
    }
    pub async fn cancelled(&self) {
        let notified = self.0.notify.notified();
        tokio::pin!(notified);
        notified.as_mut().enable();
        if self.is_cancelled() {
            return;
        }
        notified.await;
    }
    pub fn spawn_blocking<F, R>(&self, work: F) -> tokio::task::JoinHandle<R>
    where
        F: FnOnce() -> R + Send + 'static,
        R: Send + 'static,
    {
        self.0.workers.fetch_add(1, Ordering::AcqRel);
        let worker = BlockingWorker(Arc::clone(&self.0));
        tokio::task::spawn_blocking(move || {
            let _worker = worker;
            work()
        })
    }

    fn workers_finished(&self) -> bool {
        self.0.workers.load(Ordering::Acquire) == 0
    }

    pub async fn wait_for_workers(&self) {
        loop {
            let notified = self.0.workers_finished.notified();
            tokio::pin!(notified);
            notified.as_mut().enable();
            if self.workers_finished() {
                return;
            }
            notified.await;
        }
    }
}

struct BlockingWorker(Arc<CancelState>);

impl Drop for BlockingWorker {
    fn drop(&mut self) {
        if self.0.workers.fetch_sub(1, Ordering::AcqRel) == 1 {
            self.0.workers_finished.notify_waiters();
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum DownloadPhase {
    #[default]
    Preparing,
    Verifying,
    Downloading,
}
#[derive(Clone, Debug, Default)]
pub struct DownloadProgress {
    pub phase: DownloadPhase,
    pub completed_bytes: u64,
    pub verification_bytes: Option<u64>,
    pub total_bytes: u64,
    pub network_bytes: u64,
    pub content_bytes: u64,
    pub completed_files: u32,
    pub total_files: u32,
    pub current_file: String,
}

#[derive(Clone, Debug)]
pub struct DownloadSummary {
    pub downloaded_bytes: u64,
    pub content_bytes: u64,
    pub reused_bytes: u64,
    pub completed_files: u32,
    pub total_bytes: u64,
}
pub struct Reporter {
    status: Mutex<DownloadProgress>,
    callback: Box<dyn Fn(DownloadProgress) + Send + Sync>,
}

impl Reporter {
    pub fn new(
        initial: DownloadProgress,
        callback: impl Fn(DownloadProgress) + Send + Sync + 'static,
    ) -> Arc<Self> {
        let reporter = Arc::new(Self {
            status: Mutex::new(initial),
            callback: Box::new(callback),
        });
        reporter.update(|_| {});
        reporter
    }

    pub fn update(&self, change: impl FnOnce(&mut DownloadProgress)) {
        let mut status = self.status.lock().unwrap_or_else(PoisonError::into_inner);
        change(&mut status);
        (self.callback)(status.clone());
    }

    pub fn snapshot(&self) -> DownloadProgress {
        self.status
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    pub fn summary(&self, reused_bytes: u64) -> DownloadSummary {
        let status = self.snapshot();
        DownloadSummary {
            downloaded_bytes: status.network_bytes,
            content_bytes: status.content_bytes,
            reused_bytes,
            completed_files: status.completed_files,
            total_bytes: status.total_bytes,
        }
    }
}
pub async fn pump_chunks<C, T, E, F>(
    requests: mpsc::UnboundedReceiver<C>,
    deliveries: mpsc::Sender<Result<T, E>>,
    concurrency: usize,
    cancel: &CancelToken,
    fetch: impl Fn(C) -> F,
) where
    F: Future<Output = Result<T, E>>,
    E: From<Cancelled>,
{
    let requests = stream::unfold(requests, |mut requests| async move {
        requests.recv().await.map(|chunk| (chunk, requests))
    });
    let fetched = requests.map(fetch).buffered(concurrency);
    tokio::pin!(fetched);
    loop {
        let next = tokio::select! {
            result = fetched.next() => result,
            () = deliveries.closed() => return,
            () = cancel.cancelled() => {
                let _ = deliveries.send(Err(Cancelled.into())).await;
                return;
            }
        };
        let Some(result) = next else { return };
        let failed = result.is_err();
        if deliveries.send(result).await.is_err() || failed {
            return;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;

    #[test]
    fn check_reports_the_flag_and_cancellation_is_shared_by_every_clone() {
        let cancel = CancelToken::new();
        let clone = cancel.clone();
        assert!(cancel.check().is_ok());
        assert!(!clone.is_cancelled());
        clone.cancel();
        assert!(cancel.is_cancelled());
        assert!(matches!(cancel.check(), Err(Cancelled)));
    }

    #[tokio::test]
    async fn waiting_on_a_token_cancelled_earlier_returns_instead_of_hanging() {
        let cancel = CancelToken::new();
        cancel.cancel();
        cancel.cancelled().await;
    }

    #[tokio::test]
    async fn a_pending_waiter_wakes_on_a_cancellation_from_another_task() {
        let cancel = CancelToken::new();
        let waiter = cancel.clone();
        let woken = tokio::spawn(async move { waiter.cancelled().await });
        tokio::task::yield_now().await;
        cancel.cancel();
        woken.await.unwrap();
    }

    #[test]
    fn the_reporter_publishes_its_initial_snapshot_once_before_new_returns() {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&seen);
        let reporter = Reporter::new(
            DownloadProgress {
                total_files: 3,
                ..DownloadProgress::default()
            },
            move |snapshot| sink.lock().unwrap().push(snapshot.total_files),
        );
        assert_eq!(
            *seen.lock().unwrap(),
            [3],
            "observers see the starting state"
        );
        reporter.update(|status| status.completed_files = 1);
        assert_eq!(*seen.lock().unwrap(), [3, 3]);
        assert_eq!(reporter.snapshot().completed_files, 1);
    }

    #[test]
    fn a_cancellation_from_inside_the_callback_is_visible_when_update_returns() {
        let cancel = CancelToken::new();
        let inner = cancel.clone();
        let reporter = Reporter::new(DownloadProgress::default(), move |status| {
            if status.completed_bytes > 0 {
                inner.cancel();
            }
        });
        assert!(!cancel.is_cancelled());
        reporter.update(|status| status.completed_bytes = 1);
        assert!(cancel.is_cancelled());
    }

    #[test]
    fn the_summary_reports_network_bytes_as_downloaded_and_keeps_reused_separate() {
        let reporter = Reporter::new(DownloadProgress::default(), |_| {});
        reporter.update(|status| {
            status.network_bytes = 900;
            status.content_bytes = 800;
            status.completed_files = 4;
            status.total_bytes = 5_000;
        });
        let summary = reporter.summary(1_200);
        assert_eq!(summary.downloaded_bytes, 900);
        assert_eq!(summary.content_bytes, 800);
        assert_eq!(summary.reused_bytes, 1_200);
        assert_eq!(summary.completed_files, 4);
        assert_eq!(summary.total_bytes, 5_000);
    }
    fn gates(count: usize) -> Vec<Arc<Notify>> {
        (0..count).map(|_| Arc::new(Notify::new())).collect()
    }

    #[tokio::test]
    async fn chunks_are_delivered_in_request_order_however_they_finish() {
        let (requests, request_rx) = mpsc::unbounded_channel();
        let (deliveries, mut delivered) = mpsc::channel(8);
        for index in 0..3_usize {
            requests.send(index).unwrap();
        }
        drop(requests);
        let open = gates(3);
        let fetch_gates = open.clone();
        let cancel = CancelToken::new();
        let pump = pump_chunks(request_rx, deliveries, 3, &cancel, move |index: usize| {
            let gate = Arc::clone(&fetch_gates[index]);
            async move {
                gate.notified().await;
                Ok::<usize, Cancelled>(index)
            }
        });
        let collect = async {
            for index in [2_usize, 1, 0] {
                open[index].notify_one();
            }
            let mut order = Vec::new();
            while let Some(result) = delivered.recv().await {
                order.push(result.unwrap());
            }
            order
        };
        let (_, order) = tokio::join!(pump, collect);
        assert_eq!(order, [0, 1, 2], "the disk thread writes in manifest order");
    }

    #[tokio::test]
    async fn no_more_than_the_requested_number_of_fetches_are_in_flight() {
        let (requests, request_rx) = mpsc::unbounded_channel();
        let (deliveries, mut delivered) = mpsc::channel(8);
        for index in 0..6_usize {
            requests.send(index).unwrap();
        }
        drop(requests);
        let open = gates(6);
        let fetch_gates = open.clone();
        let active = Arc::new(AtomicUsize::new(0));
        let peak = Arc::new(AtomicUsize::new(0));
        let counters = (Arc::clone(&active), Arc::clone(&peak));
        let cancel = CancelToken::new();
        let pump = pump_chunks(request_rx, deliveries, 2, &cancel, move |index: usize| {
            let gate = Arc::clone(&fetch_gates[index]);
            let (active, peak) = (Arc::clone(&counters.0), Arc::clone(&counters.1));
            async move {
                let running = active.fetch_add(1, Ordering::AcqRel) + 1;
                peak.fetch_max(running, Ordering::AcqRel);
                gate.notified().await;
                active.fetch_sub(1, Ordering::AcqRel);
                Ok::<usize, Cancelled>(index)
            }
        });
        let collect = async {
            for gate in &open {
                gate.notify_one();
                tokio::task::yield_now().await;
            }
            let mut count = 0;
            while delivered.recv().await.is_some() {
                count += 1;
            }
            count
        };
        let (_, count) = tokio::join!(pump, collect);
        assert_eq!(count, 6);
        assert_eq!(peak.load(Ordering::Acquire), 2, "CDN requests stay bounded");
        assert_eq!(active.load(Ordering::Acquire), 0);
    }

    #[tokio::test]
    async fn cancellation_is_delivered_so_a_blocked_disk_thread_wakes() {
        let (requests, request_rx) = mpsc::unbounded_channel();
        let (deliveries, mut delivered) = mpsc::channel(4);
        requests.send(0_usize).unwrap();
        drop(requests);
        let stuck = Arc::new(Notify::new());
        let held = Arc::clone(&stuck);
        let cancel = CancelToken::new();
        let pump = pump_chunks(request_rx, deliveries, 1, &cancel, move |index: usize| {
            let gate = Arc::clone(&held);
            async move {
                gate.notified().await;
                Ok::<usize, Cancelled>(index)
            }
        });
        let collect = async {
            cancel.cancel();
            delivered.recv().await
        };
        let (_, result) = tokio::join!(pump, collect);
        assert!(
            matches!(result, Some(Err(Cancelled))),
            "a disk thread blocked on the queue receives the cancellation"
        );
        let _ = stuck;
    }

    #[tokio::test]
    async fn the_pump_stops_when_the_disk_side_goes_away() {
        let (requests, request_rx) = mpsc::unbounded_channel();
        let (deliveries, delivered) = mpsc::channel::<Result<usize, Cancelled>>(1);
        for index in 0..8_usize {
            requests.send(index).unwrap();
        }
        drop(requests);
        drop(delivered);
        let started = Arc::new(AtomicUsize::new(0));
        let counter = Arc::clone(&started);
        let cancel = CancelToken::new();
        pump_chunks(request_rx, deliveries, 2, &cancel, move |index: usize| {
            let counter = Arc::clone(&counter);
            async move {
                counter.fetch_add(1, Ordering::AcqRel);
                Ok::<usize, Cancelled>(index)
            }
        })
        .await;
        assert!(
            started.load(Ordering::Acquire) <= 2,
            "no chunk is fetched for a receiver that is already gone"
        );
    }

    #[tokio::test]
    async fn a_failed_chunk_ends_the_pump_after_delivering_the_error() {
        let (requests, request_rx) = mpsc::unbounded_channel();
        let (deliveries, mut delivered) = mpsc::channel(8);
        for index in 0..4_usize {
            requests.send(index).unwrap();
        }
        drop(requests);
        let started = Arc::new(AtomicUsize::new(0));
        let counter = Arc::clone(&started);
        let cancel = CancelToken::new();
        let pump = pump_chunks(request_rx, deliveries, 1, &cancel, move |index: usize| {
            let counter = Arc::clone(&counter);
            async move {
                counter.fetch_add(1, Ordering::AcqRel);
                if index == 1 {
                    return Err(Cancelled);
                }
                Ok::<usize, Cancelled>(index)
            }
        });
        let collect = async {
            let mut results = Vec::new();
            while let Some(result) = delivered.recv().await {
                results.push(result);
            }
            results
        };
        let (_, results) = tokio::join!(pump, collect);
        assert!(matches!(results.as_slice(), [Ok(0), Err(Cancelled)]));
        assert_eq!(
            started.load(Ordering::Acquire),
            2,
            "a chunk that fails for good stops the queue"
        );
    }
}
