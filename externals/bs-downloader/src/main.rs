use bs_downloader::{
    protocol::{self, Command, VERSION},
    runner,
    transfer::CancelToken,
};

#[tokio::main]
async fn main() {
    if std::env::args().any(|arg| arg == "--version") {
        println!(
            "bs-downloader {} protocol {}",
            env!("CARGO_PKG_VERSION"),
            VERSION
        );
        return;
    }
    let cancel = CancelToken::new();
    let mut input = protocol::input(cancel.clone());
    let result = tokio::select! {
        result = async {
            match input.recv().await {
                Some(Command::Start { version: VERSION, options }) => runner::run(options, &mut input, &cancel).await,
                _ => Err("Unknown"),
            }
        } => result,
        () = cancel.cancelled() => {
            cancel.wait_for_workers().await;
            return;
        },
    };
    if let Err(code) = result {
        protocol::emit("Error", code, "");
        std::process::exit(1);
    }
}
