# 🚀 Deploying Judge0 on Oracle Cloud Always Free (100% Free)

This step-by-step guide explains how to deploy the **Judge0 Code Execution Engine** on **Oracle Cloud Infrastructure (OCI) Always Free Tier** and integrate it with your **FireCode Backend Server**.

---

## 📌 Prerequisites

1. An Oracle Cloud Infrastructure (OCI) Account ([Sign up free](https://www.oracle.com/cloud/free/)).
2. Basic familiarity with SSH terminal commands.
3. Access to your FireCode repository.

---

## 📍 STEP 1: Provision Oracle Cloud Always Free VM

1. Log in to your **Oracle Cloud Console**.
2. Go to **Compute** > **Instances** > **Create Instance**.
3. Set Instance Details:
   - **Name**: `firecode-judge0`
   - **Image**: `Ubuntu 22.04 LTS` (or `Ubuntu 24.04 LTS`)
   - **Shape**: Select **Ampere A1 Compute** (ARM64)
     - **OCPUs**: `4` (Always Free maximum)
     - **Memory**: `24 GB` (Always Free maximum)
     - *(Alternative if ARM unavailable: VM.Standard.E2.1.Micro with 1 vCPU & 1GB RAM)*
4. **SSH Key**: Generate or upload your public SSH key (`~/.ssh/id_rsa.pub`).
5. **Boot Volume**: Default (50 GB).
6. Click **Create** and copy your instance's **Public IP Address** (e.g., `129.146.x.x`).

---

## 📍 STEP 2: Configure Oracle Cloud VCN Security Rules (Open Port 2358)

Oracle Cloud blocks incoming traffic on non-standard ports by default. You must open port `2358`.

### 1. In Oracle Cloud Console:
1. Go to **Networking** > **Virtual Cloud Networks (VCN)**.
2. Select your VCN > Click **Security Lists** > Select **Default Security List**.
3. Click **Add Ingress Rules**:
   - **Source Type**: `CIDR`
   - **Source CIDR**: `0.0.0.0/0` (or your backend server's specific static IP for higher security)
   - **IP Protocol**: `TCP`
   - **Destination Port Range**: `2358`
   - **Description**: `Allow Judge0 API traffic`
4. Click **Add Ingress Rules**.

### 2. On the Ubuntu VM Host Firewall (via SSH):
SSH into your VM:
```bash
ssh ubuntu@<YOUR_ORACLE_VM_PUBLIC_IP>
```

Open port `2358` in `iptables`/`ufw`:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 2358 -j ACCEPT
sudo netfilter-persistent save
```
*(Or if using UFW)*:
```bash
sudo ufw allow 2358/tcp
```

---

## 📍 STEP 3: Install Docker & Docker Compose on Ubuntu

Run the following commands on your Oracle Cloud VM:

```bash
# 1. Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 3. Add ubuntu user to docker group
sudo usermod -aG docker ubuntu
newgrp docker

# 4. Verify Docker installation
docker --version
docker compose version
```

---

## 📍 STEP 4: Deploy Judge0 via Docker Compose

1. Clone or copy the `judge0` folder from your FireCode repository to your VM:
```bash
mkdir -p ~/judge0
cd ~/judge0
```
*(Copy your repository's `judge0/docker-compose.yml` and `judge0/judge0.conf` to `~/judge0`)*

2. Start the Judge0 services:
```bash
docker compose up -d
```

3. Verify running containers:
```bash
docker compose ps
```
You should see 4 containers running:
- `judge0-server-1` (Port 2358)
- `judge0-worker-1`
- `judge0-db-1` (Postgres)
- `judge0-redis-1` (Redis)

---

## 📍 STEP 5: Connect FireCode Backend to Oracle Judge0

In your FireCode Backend deployment environment (e.g., Render, Railway, VPS, or local `.env`):

Set the `JUDGE0_URL` environment variable:
```env
JUDGE0_URL=http://<YOUR_ORACLE_VM_PUBLIC_IP>:2358
```

*(If you configured authentication in `judge0.conf`, also set `JUDGE0_KEY=your_secret_key`)*.

Restart your FireCode backend server:
```bash
npm run build
npm run start
```

---

## 🧪 STEP 6: Verification & Testing

### 1. Test Judge0 API directly from terminal or browser:
```bash
curl http://<YOUR_ORACLE_VM_PUBLIC_IP>:2358/about
```
**Expected Response**:
```json
{
  "version": "1.13.1",
  "homepage": "https://judge0.com",
  ...
}
```

### 2. Test FireCode Backend Health Endpoint:
```bash
curl http://<YOUR_BACKEND_URL>/api/health
```
**Expected Response**:
```json
{
  "status": "ok",
  "services": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up" },
    "queue": { "status": "up" },
    "judge0": { "status": "up" }
  }
}
```

---

## 🛠️ Troubleshooting & Rollback Instructions

### Issue: Connection Timeout / Network Error to Port 2358
- Verify Oracle VCN Ingress Rules include port `2358`.
- Verify host firewall: `sudo iptables -L INPUT -n --line-numbers`.
- Test port accessibility from local machine: `nc -zv <YOUR_ORACLE_VM_PUBLIC_IP> 2358` or `curl http://<YOUR_ORACLE_VM_PUBLIC_IP>:2358/about`.

### Issue: Judge0 Worker overloaded or out of memory
- View logs: `docker compose logs -f worker`.
- Restart Judge0: `docker compose restart`.

### Rollback to Local Sandbox Fallback:
If Oracle Cloud VM is ever down, FireCode backend **automatically falls back** to local JS/TS/Python execution without breaking API requests.
To explicitly bypass Oracle Judge0, clear or remove `JUDGE0_URL` from your backend environment variables:
```env
# Remove or leave empty to use local execution fallback
JUDGE0_URL=http://127.0.0.1:2358
```
