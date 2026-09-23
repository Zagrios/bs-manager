pub(crate) fn format(key: &str, args: &[String]) -> String {
    serde_json::json!({ "key": key, "args": args }).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_nested_messages_and_literal_arguments() {
        let nested = format("steam.client.depot", &["42".into()]);
        let payload = format("steam.content.invalid", &[nested.clone(), "a\"b".into()]);
        let parsed: serde_json::Value = serde_json::from_str(&payload).unwrap();
        assert_eq!(parsed["key"], "steam.content.invalid");
        assert_eq!(parsed["args"][0], nested);
        assert_eq!(parsed["args"][1], "a\"b");
    }
}
