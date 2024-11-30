# Add write permissions to anybody so that this can be sync with the
#   github's bs-versions.json when starting bsmanager
/usr/bin/chmod +002 /opt/BSManager/resources/assets/jsons/bs-versions.json

# https://github.com/electron/electron/issues/42510
/usr/bin/chmod 4755 /opt/BSManager/chrome-sandbox
