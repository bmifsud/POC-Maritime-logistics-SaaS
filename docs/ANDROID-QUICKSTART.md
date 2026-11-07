# Android Chrome demonstration: portable handoff

## Requirements

Use one supported Linux machine with Node 22+, npm, OpenSSH server and Docker. Android runs Chrome and Termux. Both devices must already have a private route (same LAN or an approved Tailscale/WireGuard network). These scripts do not provision a host, install a VPN, expose public SSH, change firewall rules or grant Docker privileges.

## 1. Transfer this implementation

The working tree contains unpublished changes; a fresh GitHub clone is not sufficient. On the source machine run:

```bash
bash scripts/package-demo.sh
```

Copy the printed archive and `.sha256` file to the chosen Linux host using an approved file-transfer mechanism. Verify the archive hash against the digest obtained from the source over a trusted channel. The checksum file contains the source absolute path; after transfer, use `sha256sum <archive-name>` and compare the digest, or adjust the checksum path before `sha256sum -c`.

Extract into a new empty directory with `tar -xzf <archive-name>`. Do not overwrite another working tree. The source bundle excludes credentials, auth state, dependency directories, artifacts, evidence and Git internals. This is a source handoff, not a full disaster-recovery backup.

## 2. Prepare Linux

From the extracted repository:

```bash
bash scripts/linux-demo.sh doctor
bash scripts/linux-demo.sh prepare
bash scripts/linux-demo.sh docker-check
bash scripts/linux-demo.sh fingerprint
bash scripts/linux-demo.sh serve
```

`doctor` checks tools and Docker access; it fails honestly if Docker is unavailable. Install Chromium system libraries through the host's approved package process if `prepare` reports missing libraries (`npx playwright install-deps chromium` may require administrator rights). `serve` stays in the foreground; keep that terminal open. The dashboard binds only to Linux `127.0.0.1:4400`.

## 3. Configure Android Termux

Transfer `scripts/termux-demo.sh` to Termux private storage as `~/termux-demo.sh`. Then:

```bash
pkg install openssh curl
bash ~/termux-demo.sh setup
bash ~/termux-demo.sh start
```

Enter the reachable Linux LAN/VPN address, SSH user/port, identity path and independently verified SHA256 host fingerprint. If the script creates a new key, install only its public key on the Linux account before starting. Never transfer the private key to Linux or publish it. SSH must allow local forwarding to 127.0.0.1:4400.

Open Chrome at **http://127.0.0.1:14400**. Tap **Run maritime demo** and open that run's report. Termux background execution may require a battery-optimization exemption; keep the phone powered. Chrome does not create the SSH tunnel itself.

## 4. Device acceptance

Record actual Android and Chrome versions plus results for: run completion, report HTTP/browser access, refresh recovery, portrait/landscape, background/resume and tunnel reconnect. Keep `android-chrome-smoke` pending until these checks are executed; local mobile emulation is not equivalent.

```bash
bash ~/termux-demo.sh status
bash ~/termux-demo.sh stop
```

Docker can also be invoked remotely using `bash ~/termux-demo.sh docker-check` once the SSH host has a usable daemon. Record actual build/run results; no local Docker success is implied by generating this bundle.
