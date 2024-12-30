use winreg::enums::HKEY_LOCAL_MACHINE;
use winreg::RegKey;

const PATH: &str = "SOFTWARE\\Wow6432Node\\Oculus VR, LLC\\Oculus";

fn main() {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    // Create (or open if it already exists) the subkey
    let (key, _) = match hklm.create_subkey(PATH) {
        Ok(res) => res,
        Err(err) => return println!("{}", err.to_string()),
    };

    let res = key.set_value("AllowDevSideloaded", &1u32);

    if let Err(err) = res {
        return println!("{}", err.to_string());
    }

    println!("AllowDevSideloaded = 1 has been successfully set in {PATH}");
}
