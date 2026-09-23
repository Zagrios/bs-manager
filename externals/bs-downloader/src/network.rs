use std::time::Duration;

pub fn client() -> Result<reqwest::Client, reqwest::Error> {
    let roots = webpki_root_certs::TLS_SERVER_ROOT_CERTS
        .iter()
        .map(|certificate| reqwest::Certificate::from_der(certificate.as_ref()))
        .collect::<Result<Vec<_>, _>>()?;
    reqwest::Client::builder()
        .tls_certs_only(roots)
        .user_agent(concat!(
            "BSManager/bs-downloader-",
            env!("CARGO_PKG_VERSION")
        ))
        .https_only(true)
        .http1_only()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .pool_idle_timeout(Duration::from_secs(60))
        .build()
}

pub enum BodyError {
    Network,
    TooLarge,
}

pub async fn read_bounded(
    mut response: reqwest::Response,
    limit: usize,
) -> Result<Vec<u8>, BodyError> {
    if response
        .content_length()
        .is_some_and(|size| size > limit as u64)
    {
        return Err(BodyError::TooLarge);
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| BodyError::Network)? {
        if body.len().saturating_add(chunk.len()) > limit {
            return Err(BodyError::TooLarge);
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}
