# pritunl-boot

[![github](https://img.shields.io/badge/github-pritunl-11bdc2.svg?style=flat)](https://github.com/pritunl)
[![twitter](https://img.shields.io/badge/twitter-pritunl-55acee.svg?style=flat)](https://twitter.com/pritunl)
[![medium](https://img.shields.io/badge/medium-pritunl-b32b2b.svg?style=flat)](https://pritunl.medium.com)
[![forum](https://img.shields.io/badge/discussion-forum-ffffff.svg?style=flat)](https://forum.pritunl.com)

[Pritunl Boot](https://boot.pritunl.com) is an interactive iPXE
boot installation tool. This tool allows for an iPXE Linux installation without
knowledge of the system resources such as disk layout and network adapters. The
Linux Kickstart installation script will send the resource layout to the boot
tool web server. Then the web app will prompt for selecting disks and
configuring the network adapters. The Kickstart script will poll the web server
waiting for the configuration, and once the selections are made from the web
app, the configuration will be applied to the installation.

[![pritunl](public/logo-code.png)](https://github.com/pritunl/pritunl-boot)

## Debugging

During installation use `Alt+F2` to access the console then check the log
files in `/tmp/<ks-log>`.

After installation the post install script log is available at
`/root/ks-post.log` and the network configuration log at
`journalctl -u network-migration.service`.

## Building

```bash
sudo dnf -y install git-core npm
git clone https://github.com/pritunl/pritunl-boot.git
cd pritunl-boot
npm install
npx wrangler
npm run dev
rpm run deploy
```

## Building iPXE

```bash
sudo dnf -y install git-core gcc binutils make perl xz-devel mtools syslinux xorriso
git clone https://github.com/pritunl/pritunl-boot.git
git clone https://github.com/ipxe/ipxe.git
cd ipxe/src
tee config/local/general.h << 'EOF'
#ifndef CONFIG_LOCAL_GENERAL_H
#define CONFIG_LOCAL_GENERAL_H

/** @file
 *
 * Local general configuration
 *
 */

 /*
 * Banner timeout configuration
 *
 */
#undef BANNER_TIMEOUT
#define BANNER_TIMEOUT          100

/*
 * Download protocols
 *
 */
#define DOWNLOAD_PROTO_HTTPS    /* Secure Hypertext Transfer Protocol */

/*
 * Image types
 *
 * Etherboot supports various image formats.  Select whichever ones
 * you want to use.
 *
 */
#define IMAGE_SCRIPT            /* iPXE script image support */
#define IMAGE_LKRN              /* Linux kernel image support */
#define IMAGE_ZLIB              /* ZLIB image support */
#define IMAGE_GZIP              /* GZIP image support */

/*
 * Command-line commands to include
 *
 */
#define DIGEST_CMD              /* Image crypto digest commands */
#define VLAN_CMD                /* VLAN commands */
#define REBOOT_CMD              /* Reboot command */
#define IMAGE_TRUST_CMD         /* Image trust management commands */
#define PING_CMD                /* Ping command */
#define CERT_CMD                /* Certificate management commands */

#endif /* CONFIG_LOCAL_GENERAL_H */
EOF

make bin-x86_64-efi/ipxe.iso
sha256sum bin-x86_64-efi/ipxe.iso
s3c cp bin-x86_64-efi/ipxe.iso r2-pxe:/ipxe.iso
```
