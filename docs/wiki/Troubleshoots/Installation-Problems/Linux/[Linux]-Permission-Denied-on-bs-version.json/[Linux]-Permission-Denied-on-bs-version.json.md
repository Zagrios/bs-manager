<pre>
Unhandled Exception UnhandledRejection Error: EACCES: permission denied, open '/opt/BSManager/resources/assets/jsons/bs-versions.json'
</pre>

To fix this issue, the current user must have write permissions to the "bs-versions.json". To correct the permissions do command below:

```bash
chmod +002 /opt/BSManager/resources/assets/jsons/bs-versions.json

# or

chown $(whoami) /opt/BSManager/resources/assets/jsons/bs-versions.json
```
