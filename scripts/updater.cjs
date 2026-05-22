const fs = require('fs');
const path = require('path');

async function main() {
  try {
    // 1. Read version from tauri.conf.json
    const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    const version = tauriConf.version;

    console.log(`Configured Tauri App Version: ${version}`);

    // 2. Locate built installer / zip and signature
    // In Tauri v2, output is in src-tauri/target/release/bundle/updater/
    // In Tauri v1, output is in src-tauri/target/release/bundle/nsis/
    let bundleDir = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', 'updater');
    if (!fs.existsSync(bundleDir)) {
      bundleDir = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', 'nsis');
    }
    
    console.log(`Scanning directory: ${bundleDir}`);
    if (!fs.existsSync(bundleDir)) {
      throw new Error(`Build directory not found at: ${bundleDir}`);
    }

    const files = fs.readdirSync(bundleDir);
    console.log("All files in bundle directory:", files);

    // Find the signature file (ends with .sig)
    const sigFile = files.find(f => f.endsWith('.sig'));
    if (!sigFile) {
      throw new Error(`Could not find any signature (.sig) file in: ${bundleDir}`);
    }

    // The update payload file is the signature file name without the .sig extension
    const payloadFile = sigFile.slice(0, -4);
    if (!files.includes(payloadFile)) {
      throw new Error(`Could not find matching update payload file "${payloadFile}" for signature "${sigFile}"`);
    }

    console.log(`Found update payload: ${payloadFile}`);
    console.log(`Found signature file: ${sigFile}`);

    // 3. Read signature content
    const signature = fs.readFileSync(path.join(bundleDir, sigFile), 'utf8').trim();
    console.log(`Signature: ${signature}`);

    // 4. Construct download URL pointing to the GitHub Release
    const repoName = 'muhammadsherazsandila/aeroplayer-desktop';
    const downloadUrl = `https://github.com/${repoName}/releases/download/v${version}/${payloadFile}`;

    // 5. Build/Update updater.json structure
    const updaterJsonPath = path.join(__dirname, '..', 'updater.json');
    let updater = {
      version: version,
      notes: `AeroPlayer version ${version} auto-update. Premium glassmorphic desktop video player experience refined.`,
      pub_date: new Date().toISOString(),
      platforms: {
        "windows-x86_64": {
          signature: signature,
          url: downloadUrl
        }
      }
    };

    fs.writeFileSync(updaterJsonPath, JSON.stringify(updater, null, 2), 'utf8');
    console.log(`Successfully generated updater.json at root:`, JSON.stringify(updater, null, 2));

  } catch (error) {
    console.error('Error generating updater.json:', error.message);
    process.exit(1);
  }
}

main();
