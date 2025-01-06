This is encountered when running the app file or executing the app in the terminal. This is due to a change to Ubuntu 24.04. In order to fix the issue, take a look into the path of "chrome-sandbox" described in the error log and give the correct permissions within the terminal, for example:

```bash
chmod 4755 /opt/BSManager/chrome-sandbox
```

ref: https://github.com/electron/electron/issues/42510
