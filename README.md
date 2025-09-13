# pritunl-boot

[![github](https://img.shields.io/badge/github-pritunl-11bdc2.svg?style=flat)](https://github.com/pritunl)
[![twitter](https://img.shields.io/badge/twitter-pritunl-55acee.svg?style=flat)](https://twitter.com/pritunl)
[![medium](https://img.shields.io/badge/medium-pritunl-b32b2b.svg?style=flat)](https://pritunl.medium.com)
[![forum](https://img.shields.io/badge/discussion-forum-ffffff.svg?style=flat)](https://forum.pritunl.com)

[Pritunl Boot](https://github.com/pritunl/pritunl-boot) is an interactive iPXE
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
