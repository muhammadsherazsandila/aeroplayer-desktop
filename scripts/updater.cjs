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
    // In Tauri v2, output is in src-tauri/target/release/bundle/nsis/ or msi/
    const bundleDir = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', 'nsis');
    
    if (!fs.existsSync(bundleDir)) {
      throw new Error(`Build directory not found at: ${bundleDir}`);
    }

    const files = fs.readdirSync(bundleDir);
    const zipFile = files.find(f => f.endsWith('.nsis.zip'));
    const sigFile = files.find(f => f.endsWith('.nsis.zip.sig'));

    if (!zipFile || !sigFile) {
      throw new Error(`Could not find updater zip or signature file in: ${bundleDir}`);
    }

    console.log(`Found update bundle: ${zipFile}`);
    console.log(`Found signature file: ${sigFile}`);

    // 3. Read signature content
    const signature = fs.readFileSync(path.join(bundleDir, sigFile), 'utf8').trim();
    console.log(`Signature: ${signature}`);

    // 4. Construct download URL pointing to the GitHub Release
    const repoName = 'muhammadsherazsandila/aeroplayer-desktop';
    const downloadUrl = `https://github.com/${repoName}/releases/download/v${version}/${zipFile}`;

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
