import * as Types from "./types"
import * as Utils from "./utils"

export function generateIpxe(data: Types.Configuration): string {
	if (data.provider === "latitude") {
		return `#!ipxe
ifopen net{{ INTERFACE_ID }}
set net{{ INTERFACE_ID }}/ip {{ PUBLIC_IP }}
set net{{ INTERFACE_ID }}/netmask {{ NETMASK }}
set net{{ INTERFACE_ID }}/gateway {{ PUBLIC_GW }}
set net{{ INTERFACE_ID }}/dns 8.8.8.8

kernel http://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/images/pxeboot/vmlinuz inst.repo=https://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/ inst.ks=http://boot.pritunl.com/${data.id}.ks modprobe.blacklist=rndis_host net.ifnames=0 biosdevname=0 ip={{ PUBLIC_IP }}::{{ PUBLIC_GW }}:{{ NETMASK }}::eth{{ INTERFACE_ID }}:off:8.8.8.8
initrd http://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/images/pxeboot/initrd.img
boot`
	}

	let network = ""
	if (data.network_mode === "static") {
		network = ` net.ifnames=0 biosdevname=0 ${getKernelNetwork(data)}`
	}

	return `#!ipxe
kernel http://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/images/pxeboot/vmlinuz inst.repo=https://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/ inst.ks=http://boot.pritunl.com/${data.id}.ks modprobe.blacklist=rndis_host${network}
initrd http://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/images/pxeboot/initrd.img
boot`
}

function getKernelNetwork(data: Types.Configuration): string {
	const publicIp = Utils.cidrToIp(data.public_ip)
	const netmask = Utils.cidrToNetmask(data.public_ip)
	let iface = data.interface || "eth0"
	if (data.vlan != 0) {
		iface += `.${data.vlan}`
	}

	return `ip=${publicIp}::${data.gateway_ip}:${netmask}::${iface}:off:8.8.8.8`
}

export function generateKickstartNetwork(data: Types.Configuration): string {
	let conf = ``
	let rootIface = ""

	if (data.bonded_network && data.interfaces && data.interfaces.length >= 2) {
		rootIface = "bond0"
		conf += `
nmcli connection add type bond con-name ${rootIface} ifname ${rootIface} bond.options mode=802.3ad,lacp_rate=fast,miimon=100,xmit_hash_policy=layer3+4`
		data.interfaces.forEach((iface: string, index: number) => {
			conf += `
nmcli connection add type bond-slave con-name bond0-slave${index} ifname ${iface} master bond0`
		})
	} else {
		if (data.interfaces) {
			rootIface = data.interfaces[0]
		} else {
			rootIface = `"\\$INTERFACE"`
		}

		conf += `
nmcli connection add type ethernet con-name ${rootIface} ifname ${rootIface} connection.autoconnect yes`

		if (data.mtu) {
			conf += `
nmcli connection modify ${rootIface} 802-3-ethernet.mtu ${data.mtu}`
		}
	}

	if (data.vlan && data.vlan6) {
		conf += `
nmcli connection modify ${rootIface} ipv4.method disabled ipv6.method ignore`
	} else {
		if (!data.vlan) {
			if (data.network_mode === "static") {
				conf += `
nmcli connection modify ${rootIface} ipv4.method manual ipv4.addresses ${data.public_ip} ipv4.gateway ${data.gateway_ip} ipv4.dns "8.8.8.8,8.8.4.4"`
			} else {
				conf += `
nmcli connection modify ${rootIface} ipv4.method auto ipv4.dns "8.8.8.8,8.8.4.4"`
			}
		} else {
			conf += `
nmcli connection modify ${rootIface} ipv4.method disabled`
		}

		if (!data.vlan6) {
			if (data.network_mode === "static" && data.public_ip6) {
				conf += `
nmcli connection modify ${rootIface} ipv6.method manual ipv6.addresses ${data.public_ip6}`
				if (data.gateway_ip6) {
					conf += `
	nmcli connection modify ${rootIface} ipv6.gateway ${data.gateway_ip6}`
				}
			} else {
				conf += `
nmcli connection modify ${rootIface} ipv6.method auto`
			}
		} else {
			conf += `
nmcli connection modify ${rootIface} ipv6.method ignore`
		}
	}

	conf += `
nmcli connection up ${rootIface}
sleep 1
`

	if (data.vlan) {
		let vlanIface = `${rootIface}.${data.vlan}`
		conf += `
nmcli connection add type vlan con-name ${vlanIface} ifname ${vlanIface} dev ${rootIface} id ${data.vlan} connection.autoconnect yes`

		if (data.mtu) {
			conf += `
nmcli connection modify ${vlanIface} 802-3-ethernet.mtu ${data.mtu}`
		}

		if (data.network_mode === "static") {
			conf += `
nmcli connection modify ${vlanIface} ipv4.method manual ipv4.addresses ${data.public_ip} ipv4.gateway ${data.gateway_ip} ipv4.dns "8.8.8.8,8.8.4.4"`
		} else {
			conf += `
nmcli connection modify ${vlanIface} ipv4.method auto ipv4.dns "8.8.8.8,8.8.4.4"`
		}

		if (data.vlan === data.vlan6) {
			if (data.network_mode === "static" && data.public_ip6) {
				conf += `
nmcli connection modify ${vlanIface} ipv6.method manual ipv6.addresses ${data.public_ip6}`
				if (data.gateway_ip6) {
					conf += `
	nmcli connection modify ${vlanIface} ipv6.gateway ${data.gateway_ip6}`
				}
			} else {
				conf += `
nmcli connection modify ${vlanIface} ipv6.method auto`
			}
		} else {
			conf += `
nmcli connection modify ${vlanIface} ipv6.method ignore`
		}

		conf += `
nmcli connection up ${vlanIface}
`
	}

	if (data.vlan6 && data.vlan6 !== data.vlan) {
		let vlanIface6 = `${rootIface}.${data.vlan6}`
		conf += `
nmcli connection add type vlan con-name ${vlanIface6} ifname ${vlanIface6} dev ${rootIface} id ${data.vlan6} ipv4.method disabled connection.autoconnect yes`

		if (data.mtu) {
			conf += `
nmcli connection modify ${vlanIface6} 802-3-ethernet.mtu ${data.mtu}`
		}

		if (data.network_mode === "static" && data.public_ip6) {
			conf += `
nmcli connection modify ${vlanIface6} ipv6.method manual ipv6.addresses ${data.public_ip6}`
			if (data.gateway_ip6) {
				conf += `
nmcli connection modify ${vlanIface6} ipv6.gateway ${data.gateway_ip6}`
			}
		} else {
			conf += `
nmcli connection modify ${vlanIface6} ipv6.method auto`
		}

		conf += `
nmcli connection up ${vlanIface6}
`
	}

	return conf
}

export function generateKickstart(data: Types.Configuration): string {
	const sshKeys = Utils.decodeBase64(data.ssh_keys)
	const publicIp = Utils.cidrToIp(data.public_ip)

    let rootSize = ""
    if (!data.root_size || data.root_size === "") {
        rootSize = "--size=2"
    } else {
        const match = data.root_size.match(/^(\d+)GB$/i)
        if (match) {
            let gb = parseInt(match[1])
            if (gb < 2) {
                gb = 2
            }
            rootSize = `--maxsize=${gb * 1024}`
        } else {
            rootSize = "--size=2"
        }
    }

	return `text
reboot
url --url="https://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/"
repo --name="AppStream" --baseurl="http://repo.almalinux.org/almalinux/10/AppStream/x86_64/os/"

%addon com_redhat_kdump --disable
%end

keyboard --xlayouts='us'
lang en_US.UTF-8

%packages
@^minimal-environment
@standard
-kexec-tools
%end

firstboot --enable

%include /tmp/storage.ks

timezone Etc/UTC --utc

rootpw --plaintext cloud

%pre
#!/bin/bash

echo "=== Scanning for install disks ==="

DISKS=()
for disk in /sys/block/sd* /sys/block/nvme*n1 /sys/block/vd*; do
    if [ ! -e "$disk" ]; then
        continue
    fi

    if [ ! -e "$disk/size" ]; then
        continue
    fi

    diskname=$(basename $disk)
    size=$(cat $disk/size)

    if readlink -f /sys/block/$diskname | grep -q '/usb[0-9]*/'; then
        echo "Ignoring $diskname USB device"
        continue
    fi

    if [ $size -lt 67108864 ]; then
        echo "Ignoring $diskname too small"
        continue
    fi

    if [ -f "/sys/block/$diskname/removable" ]; then
        removable=$(cat /sys/block/$diskname/removable)
    else
        removable=0
    fi

    if [ "$removable" = "1" ]; then
        echo "Ignoring $diskname removable media"
        continue
    fi

    echo "Detected disk $diskname ($(($size * 512 / 1073741824))GB)"
    DISKS+=($diskname)
done

echo "=== Destroying existing raid arrays ==="
for md in /dev/md*; do
    if [ -e "$md" ]; then
        umount -f $md 2>/dev/null
        echo inactive > /sys/block/$(basename $md)/md/array_state 2>/dev/null
        sleep 1
        mdadm --stop $md --force 2>/dev/null
    fi
done

sleep 2

for disk in "\${DISKS[@]}"; do
    for partition in /dev/\${disk}*; do
        if [ -e "$partition" ] && [ "$partition" != "/dev/$disk" ]; then
            mdadm --zero-superblock $partition 2>/dev/null
            partition_name=$(basename $partition)
            if [ -e "/sys/block/$disk/$partition_name/size" ]; then
                partition_size=$(cat /sys/block/$disk/$partition_name/size)
                if [ -n "$partition_size" ] && [ "$partition_size" -gt 2048 ]; then
                    seek_position=$((partition_size - 2048))
                    dd if=/dev/zero of=$partition bs=512 seek=$seek_position count=2048 2>/dev/null
                fi
            fi
            wipefs -a $partition 2>/dev/null
        fi
    done

    mdadm --zero-superblock /dev/$disk 2>/dev/null
    disk_size=$(cat /sys/block/$disk/size)
    if [ -n "$disk_size" ]; then
        seek_position=$((disk_size - 2048))
        dd if=/dev/zero of=/dev/$disk bs=512 seek=$seek_position count=2048 2>/dev/null
    fi
    wipefs -a /dev/$disk 2>/dev/null
done

RAID="${data.raid}"
if [ "$RAID" != "-1" ]; then
    if [ \${#DISKS[@]} -lt 2 ]; then
        echo "WARNING: RAID requested but only \${#DISKS[@]} disk(s) found. Falling back to single disk."
        RAID="-1"
    elif [ "$RAID" = "10" ] && [ \${#DISKS[@]} -lt 4 ]; then
        echo "WARNING: RAID 10 requested but only \${#DISKS[@]} disk(s) found. Falling back to RAID 1."
        RAID="1"
    fi
fi

echo "=== Creating storage plan ==="

if [ "$RAID" = "1" ]; then
    tee /tmp/storage.ks << EOF
ignoredisk --only-use=\${DISKS[0]},\${DISKS[1]}
clearpart --all --initlabel
part biosboot --ondisk=\${DISKS[0]} --size=1 --fstype="biosboot"
part biosboot --ondisk=\${DISKS[1]} --size=1 --fstype="biosboot"
part raid.11 --fstype="efi" --ondisk=\${DISKS[0]} --size=100 --fsoptions="umask=0077,shortname=winnt"
part raid.12 --fstype="efi" --ondisk=\${DISKS[1]} --size=100 --fsoptions="umask=0077,shortname=winnt"
part raid.21 --ondisk=\${DISKS[0]} ${rootSize} --grow
part raid.22 --ondisk=\${DISKS[1]} ${rootSize} --grow
raid /boot/efi --level=1 --device=md0 raid.11 raid.12 --fstype="efi" --fsoptions="umask=0077,shortname=winnt"
raid / --level=1 --device=md1 raid.21 raid.22 --fstype="xfs"
EOF
elif [ "$RAID" = "10" ]; then
    tee /tmp/storage.ks << EOF
ignoredisk --only-use=\${DISKS[0]},\${DISKS[1]},\${DISKS[2]},\${DISKS[3]}
clearpart --all --initlabel
part biosboot --ondisk=\${DISKS[0]} --size=1 --fstype="biosboot"
part biosboot --ondisk=\${DISKS[1]} --size=1 --fstype="biosboot"
part biosboot --ondisk=\${DISKS[2]} --size=1 --fstype="biosboot"
part biosboot --ondisk=\${DISKS[3]} --size=1 --fstype="biosboot"
part raid.11 --fstype="efi" --ondisk=\${DISKS[0]} --size=100 --fsoptions="umask=0077,shortname=winnt"
part raid.12 --fstype="efi" --ondisk=\${DISKS[1]} --size=100 --fsoptions="umask=0077,shortname=winnt"
part raid.21 --ondisk=\${DISKS[0]} ${rootSize} --grow
part raid.22 --ondisk=\${DISKS[1]} ${rootSize} --grow
part raid.23 --ondisk=\${DISKS[2]} ${rootSize} --grow
part raid.24 --ondisk=\${DISKS[3]} ${rootSize} --grow
raid /boot/efi --level=1 --device=md0 raid.11 raid.12 --fstype="efi" --fsoptions="umask=0077,shortname=winnt"
raid / --level=10 --device=md1 raid.21 raid.22 raid.23 raid.24 --fstype="xfs"
EOF
else
    tee /tmp/storage.ks << EOF
ignoredisk --only-use=\${DISKS[0]}
clearpart --all --initlabel
part biosboot --ondisk=\${DISKS[0]} --size=1 --fstype="biosboot"
part /boot/efi --fstype="efi" --ondisk=\${DISKS[0]} --size=100 --fsoptions="umask=0077,shortname=winnt"
part / --fstype="xfs" --ondisk=\${DISKS[0]} ${rootSize} --grow
EOF
fi
%end

%post --log=/root/ks-post.log
#!/bin/bash
set -x
echo "=== Running post setup ==="

grubby --update-kernel=ALL --remove-args="crashkernel net.ifnames biosdevname"

get_mac_from_ip() {
    local ip="$1"
    interface=$(ip -br addr show | grep "$ip" | awk '{print $1}')
    if [ -z "$interface" ]; then
        echo "No interface found with IP $ip"
        return 1
    fi
    mac=$(ip link show "$interface" | grep -oP 'link/ether \\K[0-9a-f:]+')
    if [ -z "$mac" ]; then
        echo "Could not find MAC address for interface $interface"
        return 1
    fi
    echo "$mac"
}

PUBLIC_MAC_ADDR=$(get_mac_from_ip "${publicIp}")

tee /etc/systemd/system/network-migration.service << EOF
[Unit]
Description=Network interface migration
After=network.target systemd-networkd.service NetworkManager.service
Wants=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/network-migration.sh
RemainAfterExit=no
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

tee /usr/local/bin/network-migration.sh << EOF
#!/bin/bash
set -x
MAC_ADDR="$PUBLIC_MAC_ADDR"
NET_MODE="${data.network_mode}"
PUBLIC_IP="${data.public_ip}"
GATEWAY_IP="${data.gateway_ip}"
VLAN_ID="${data.vlan}"
PUBLIC_IP6="${data.public_ip6}"
GATEWAY_IP6="${data.gateway_ip6}"
VLAN_ID6="${data.vlan6}"
MTU="${data.mtu}"

get_iface_from_mac() {
    local mac="\\$1"
    mac=\\$(echo "\\$mac" | tr '[:upper:]' '[:lower:]')
    interface=\\$(ip -br link show | grep -i "\\$mac" | awk '{print \\$1}')
    if [ -z "\\$interface" ]; then
        echo "No interface found with MAC \\$mac"
        return 1
    fi
    echo "\\$interface"
}

INTERFACE=\\$(get_iface_from_mac "\\$MAC_ADDR")
if [ \\$? -ne 0 ] || [ -z "\\$INTERFACE" ]; then
    echo "Failed to find interface with MAC \\$MAC_ADDR"
    exit 1
fi

nmcli general hostname cloud

nmcli -g UUID connection show | while read connid; do
    nmcli connection delete "\\$connid"
done

sleep 1

if [ -n "\\$VLAN_ID" ] && [ "\\$VLAN_ID" != "0" ] && [ -n "\\$VLAN_ID6" ] && [ "\\$VLAN_ID6" != "0" ]; then
    nmcli connection add type ethernet con-name "\\$INTERFACE" ifname "\\$INTERFACE" ipv4.method disabled ipv6.method ignore connection.autoconnect yes

    if [ -n "\\$MTU" ] && [ "\\$MTU" != "0" ]; then
        nmcli connection modify "\\$INTERFACE" 802-3-ethernet.mtu "\\$MTU"
    fi

    nmcli connection up "\\$INTERFACE"
else
    nmcli connection add type ethernet con-name "\\$INTERFACE" ifname "\\$INTERFACE" connection.autoconnect yes

    if [ -z "\\$VLAN_ID" ] || [ "\\$VLAN_ID" = "0" ]; then
        if [ "\\$NET_MODE" = "static" ]; then
            nmcli connection modify "\\$INTERFACE" ipv4.method manual ipv4.addresses "\\$PUBLIC_IP" ipv4.gateway "\\$GATEWAY_IP" ipv4.dns "8.8.8.8,8.8.4.4"
        else
            nmcli connection modify "\\$INTERFACE" ipv4.method auto ipv4.dns "8.8.8.8,8.8.4.4"
        fi
    fi

    if [ -z "\\$VLAN_ID6" ] || [ "\\$VLAN_ID6" = "0" ]; then
        if [ -n "\\$PUBLIC_IP6" ]; then
            nmcli connection modify "\\$INTERFACE" ipv6.method manual ipv6.addresses "\\$PUBLIC_IP6"
        fi
        if [ -n "\\$GATEWAY_IP6" ]; then
            nmcli connection modify "\\$INTERFACE" ipv6.gateway "\\$GATEWAY_IP6"
        fi
    fi

    if [ -n "\\$MTU" ] && [ "\\$MTU" != "0" ]; then
        nmcli connection modify "\\$INTERFACE" 802-3-ethernet.mtu "\\$MTU"
    fi

    nmcli connection up "\\$INTERFACE"
fi

sleep 1

if [ -n "\\$VLAN_ID" ] && [ "\\$VLAN_ID" != "0" ] && [ "\\$VLAN_ID" = "\\$VLAN_ID6" ]; then
    VLAN_CON_NAME="\\\${INTERFACE}.\\\${VLAN_ID}"

    nmcli connection add type ethernet con-name "\\$VLAN_CON_NAME" ifname "\\$VLAN_CON_NAME" dev "\\$INTERFACE" id "\\$VLAN_ID" connection.autoconnect yes

    if [ "\\$NET_MODE" = "static" ]; then
        nmcli connection modify "\\$VLAN_CON_NAME" ipv4.method manual ipv4.addresses "\\$PUBLIC_IP" ipv4.gateway "\\$GATEWAY_IP" ipv4.dns "8.8.8.8,8.8.4.4"
    else
        nmcli connection modify "\\$INTERFACE" ipv4.method auto ipv4.dns "8.8.8.8,8.8.4.4"
    fi

    if [ -n "\\$PUBLIC_IP6" ]; then
        nmcli connection modify "\\$VLAN_CON_NAME" ipv6.method manual ipv6.addresses "\\$PUBLIC_IP6"
    fi
    if [ -n "\\$GATEWAY_IP6" ]; then
        nmcli connection modify "\\$VLAN_CON_NAME" ipv6.gateway "\\$GATEWAY_IP6"
    fi

    if [ -n "\\$MTU" ] && [ "\\$MTU" != "0" ]; then
        nmcli connection modify "\\$VLAN_CON_NAME" 802.mtu "\\$MTU"
    fi

    nmcli connection up "\\$VLAN_CON_NAME"
else
    if [ -n "\\$VLAN_ID" ] && [ "\\$VLAN_ID" != "0" ]; then
        VLAN_CON_NAME="\\$INTERFACE.\\$VLAN_ID"

        nmcli connection add type ethernet con-name "\\$VLAN_CON_NAME" ifname "\\$VLAN_CON_NAME" dev "\\$INTERFACE" id "\\$VLAN_ID" connection.autoconnect yes

        if [ "\\$NET_MODE" = "static" ]; then
            nmcli connection modify "\\$VLAN_CON_NAME" ipv4.method manual ipv4.addresses "\\$PUBLIC_IP" ipv4.gateway "\\$GATEWAY_IP" ipv4.dns "8.8.8.8,8.8.4.4"
        else
            nmcli connection modify "\\$INTERFACE" ipv4.method auto ipv4.dns "8.8.8.8,8.8.4.4"
        fi

        if [ -n "\\$MTU" ] && [ "\\$MTU" != "0" ]; then
            nmcli connection modify "\\$VLAN_CON_NAME" 802.mtu "\\$MTU"
        fi

        nmcli connection up "\\$VLAN_CON_NAME"
    fi

    if [ -n "\\$VLAN_ID6" ] && [ "\\$VLAN_ID6" != "0" ]; then
        VLAN_CON_NAME6="\\$INTERFACE.\\$VLAN_ID6"

        nmcli connection add type ethernet con-name "\\$VLAN_CON_NAME6" ifname "\\$VLAN_CON_NAME6" dev "\\$INTERFACE" id "\\$VLAN_ID6" connection.autoconnect yes

        if [ -n "\\$PUBLIC_IP6" ]; then
            nmcli connection modify "\\$VLAN_CON_NAME6" ipv6.method manual ipv6.addresses "\\$PUBLIC_IP6"
        fi
        if [ -n "\\$GATEWAY_IP6" ]; then
            nmcli connection modify "\\$VLAN_CON_NAME6" ipv6.gateway "\\$GATEWAY_IP6"
        fi

        if [ -n "\\$MTU" ] && [ "\\$MTU" != "0" ]; then
            nmcli connection modify "\\$VLAN_CON_NAME6" 802.mtu "\\$MTU"
        fi

        nmcli connection up "\\$VLAN_CON_NAME6"
    fi
fi

systemctl disable network-migration.service 2>/dev/null || true
systemctl daemon-reload 2>/dev/null || true
#rm -f /etc/systemd/system/network-migration.service
#rm -f /usr/local/bin/network-migration.sh
EOF

chmod +x /usr/local/bin/network-migration.sh
systemctl daemon-reload 2>/dev/null || true
systemctl enable network-migration.service

dnf -y update
dnf -y remove cockpit-ws

tee /etc/ssh/sshd_config.d/90-cloud.conf << EOF
PermitRootLogin no
PasswordAuthentication no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
EOF

useradd -G adm,video,wheel,systemd-journal cloud || true
#passwd -d root
#passwd -l root
passwd -d cloud
passwd -l cloud
mkdir -p /home/cloud/.ssh
chown cloud:cloud /home/cloud/.ssh
restorecon -v /home/cloud/.ssh
chmod 700 /home/cloud/.ssh
tee /etc/sudoers.d/wheel << EOF
%wheel ALL=(ALL) NOPASSWD:ALL
EOF
chmod 440 /etc/sudoers.d/wheel

tee /home/cloud/.ssh/authorized_keys << '|SSH-EOF|'
${sshKeys}
|SSH-EOF|
chown cloud:cloud /home/cloud/.ssh/authorized_keys
restorecon -v /home/cloud/.ssh/authorized_keys
chmod 600 /home/cloud/.ssh/authorized_keys

systemctl enable sshd
systemctl restart sshd
systemctl disable firewalld
systemctl stop firewalld
systemctl start chronyd
systemctl enable chronyd
%end
`
}

export function generateKickstartLive(data: Types.Configuration): string {
	const sshKeys = Utils.decodeBase64(data.ssh_keys)

	return `text
reboot
url --url="https://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/"
repo --name="AppStream" --baseurl="http://repo.almalinux.org/almalinux/10/AppStream/x86_64/os/"

%addon com_redhat_kdump --disable
%end

keyboard --xlayouts='us'
lang en_US.UTF-8

%packages
@^minimal-environment
@standard
-kexec-tools
%end

firstboot --enable

%include /tmp/storage.ks

timezone Etc/UTC --utc

rootpw --plaintext cloud

%pre
#!/bin/bash

echo "=== Scanning for install disks ==="

DISKS=()
for disk in /sys/block/sd* /sys/block/nvme*n1 /sys/block/vd*; do
    if [ ! -e "$disk" ]; then
        continue
    fi

    if [ ! -e "$disk/size" ]; then
        continue
    fi

    diskname=$(basename $disk)
    size=$(cat $disk/size)

    if readlink -f /sys/block/$diskname | grep -q '/usb[0-9]*/'; then
        echo "Ignoring $diskname USB device"
        continue
    fi

    if [ $size -lt 67108864 ]; then
        echo "Ignoring $diskname too small"
        continue
    fi

    if [ -f "/sys/block/$diskname/removable" ]; then
        removable=$(cat /sys/block/$diskname/removable)
    else
        removable=0
    fi

    if [ "$removable" = "1" ]; then
        echo "Ignoring $diskname removable media"
        continue
    fi

    echo "Detected disk $diskname ($(($size * 512 / 1073741824))GB)"
    DISKS+=($diskname)
done

echo "=== Destroying existing raid arrays ==="
for md in /dev/md*; do
    if [ -e "$md" ]; then
        umount -f $md 2>/dev/null
        echo inactive > /sys/block/$(basename $md)/md/array_state 2>/dev/null
        sleep 1
        mdadm --stop $md --force 2>/dev/null
    fi
done

sleep 2

for disk in "\${DISKS[@]}"; do
    for partition in /dev/\${disk}*; do
        if [ -e "$partition" ] && [ "$partition" != "/dev/$disk" ]; then
            mdadm --zero-superblock $partition 2>/dev/null
            partition_name=$(basename $partition)
            if [ -e "/sys/block/$disk/$partition_name/size" ]; then
                partition_size=$(cat /sys/block/$disk/$partition_name/size)
                if [ -n "$partition_size" ] && [ "$partition_size" -gt 2048 ]; then
                    seek_position=$((partition_size - 2048))
                    dd if=/dev/zero of=$partition bs=512 seek=$seek_position count=2048 2>/dev/null
                fi
            fi
            wipefs -a $partition 2>/dev/null
        fi
    done

    mdadm --zero-superblock /dev/$disk 2>/dev/null
    disk_size=$(cat /sys/block/$disk/size)
    if [ -n "$disk_size" ]; then
        seek_position=$((disk_size - 2048))
        dd if=/dev/zero of=/dev/$disk bs=512 seek=$seek_position count=2048 2>/dev/null
    fi
    wipefs -a /dev/$disk 2>/dev/null
done

RAID="${data.raid}"
if [ "$RAID" != "-1" ]; then
    if [ \${#DISKS[@]} -lt 2 ]; then
        echo "WARNING: RAID requested but only \${#DISKS[@]} disk(s) found. Falling back to single disk."
        RAID="-1"
    elif [ "$RAID" = "10" ] && [ \${#DISKS[@]} -lt 4 ]; then
        echo "WARNING: RAID 10 requested but only \${#DISKS[@]} disk(s) found. Falling back to RAID 1."
        RAID="1"
    fi
fi

echo "=== Creating storage plan ==="

if [ "$RAID" = "1" ]; then
    tee /tmp/storage.ks << EOF
ignoredisk --only-use=\${DISKS[0]},\${DISKS[1]}
clearpart --all --initlabel
part biosboot --ondisk=\${DISKS[0]} --size=1 --fstype="biosboot"
part biosboot --ondisk=\${DISKS[1]} --size=1 --fstype="biosboot"
part raid.11 --fstype="efi" --ondisk=\${DISKS[0]} --size=100 --fsoptions="umask=0077,shortname=winnt"
part raid.12 --fstype="efi" --ondisk=\${DISKS[1]} --size=100 --fsoptions="umask=0077,shortname=winnt"
part raid.21 --ondisk=\${DISKS[0]} --size=1 --grow
part raid.22 --ondisk=\${DISKS[1]} --size=1 --grow
raid /boot/efi --level=1 --device=md0 raid.11 raid.12 --fstype="efi" --fsoptions="umask=0077,shortname=winnt"
raid / --level=1 --device=md1 raid.21 raid.22 --fstype="xfs"
EOF
elif [ "$RAID" = "10" ]; then
    tee /tmp/storage.ks << EOF
ignoredisk --only-use=\${DISKS[0]},\${DISKS[1]},\${DISKS[2]},\${DISKS[3]}
clearpart --all --initlabel
part biosboot --ondisk=\${DISKS[0]} --size=1 --fstype="biosboot"
part biosboot --ondisk=\${DISKS[1]} --size=1 --fstype="biosboot"
part biosboot --ondisk=\${DISKS[2]} --size=1 --fstype="biosboot"
part biosboot --ondisk=\${DISKS[3]} --size=1 --fstype="biosboot"
part raid.11 --fstype="efi" --ondisk=\${DISKS[0]} --size=100 --fsoptions="umask=0077,shortname=winnt"
part raid.12 --fstype="efi" --ondisk=\${DISKS[1]} --size=100 --fsoptions="umask=0077,shortname=winnt"
part raid.21 --ondisk=\${DISKS[0]} --size=1 --grow
part raid.22 --ondisk=\${DISKS[1]} --size=1 --grow
part raid.23 --ondisk=\${DISKS[2]} --size=1 --grow
part raid.24 --ondisk=\${DISKS[3]} --size=1 --grow
raid /boot/efi --level=1 --device=md0 raid.11 raid.12 --fstype="efi" --fsoptions="umask=0077,shortname=winnt"
raid / --level=10 --device=md1 raid.21 raid.22 raid.23 raid.24 --fstype="xfs"
EOF
else
    tee /tmp/storage.ks << EOF
ignoredisk --only-use=\${DISKS[0]}
clearpart --all --initlabel
part biosboot --ondisk=\${DISKS[0]} --size=1 --fstype="biosboot"
part /boot/efi --fstype="efi" --ondisk=\${DISKS[0]} --size=100 --fsoptions="umask=0077,shortname=winnt"
part / --fstype="xfs" --ondisk=\${DISKS[0]} --grow
EOF
fi
%end

%post --log=/root/ks-post.log
#!/bin/bash
set -x
echo "=== Running post setup ==="

grubby --update-kernel=ALL --remove-args="crashkernel net.ifnames biosdevname"

get_mac_from_ip() {
    local ip="$1"
    interface=$(ip -br addr show | grep "$ip" | awk '{print $1}')
    if [ -z "$interface" ]; then
        echo "No interface found with IP $ip"
        return 1
    fi
    mac=$(ip link show "$interface" | grep -oP 'link/ether \\K[0-9a-f:]+')
    if [ -z "$mac" ]; then
        echo "Could not find MAC address for interface $interface"
        return 1
    fi
    echo "$mac"
}

PUBLIC_MAC_ADDR=$(get_mac_from_ip "${"TODO"}")

tee /etc/systemd/system/network-migration.service << EOF
[Unit]
Description=Network interface migration
After=network.target systemd-networkd.service NetworkManager.service
Wants=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/network-migration.sh
RemainAfterExit=no
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

tee /usr/local/bin/network-migration.sh << EOF
#!/bin/bash
set -x
MAC_ADDR="$PUBLIC_MAC_ADDR"
PUBLIC_IP="${data.public_ip}"
GATEWAY_IP="${data.gateway_ip}"
VLAN_ID="${data.vlan}"
MTU="${data.mtu}"

get_iface_from_mac() {
    local mac="\\$1"
    mac=\\$(echo "\\$mac" | tr '[:upper:]' '[:lower:]')
    interface=\\$(ip -br link show | grep -i "\\$mac" | awk '{print \\$1}')
    if [ -z "\\$interface" ]; then
        echo "No interface found with MAC \\$mac"
        return 1
    fi
    echo "\\$interface"
}

INTERFACE=\\$(get_iface_from_mac "\\$MAC_ADDR")
if [ \\$? -ne 0 ] || [ -z "\\$INTERFACE" ]; then
    echo "Failed to find interface with MAC \\$MAC_ADDR"
    exit 1
fi

nmcli general hostname cloud

nmcli -g UUID connection show | while read connid; do
    nmcli connection delete "\\$connid"
done

sleep 1

if [ -n "\\$VLAN_ID" ] && [ "\\$VLAN_ID" != "0" ]; then
    VLAN_CON_NAME="\\\${INTERFACE}.\\\${VLAN_ID}"

    nmcli connection add type ethernet con-name "\\$INTERFACE" ifname "\\$INTERFACE" ipv4.method disabled ipv6.method ignore connection.autoconnect yes

    nmcli connection up "\\$INTERFACE"

    sleep 1

    nmcli connection add type vlan con-name "\\$VLAN_CON_NAME" ifname "\\$VLAN_CON_NAME" dev "\\$INTERFACE" id "\\$VLAN_ID" ipv4.method manual ipv4.addresses "\\$PUBLIC_IP" ipv4.gateway "\\$GATEWAY_IP" ipv4.dns "8.8.8.8,8.8.4.4" connection.autoconnect yes

    if [ -n "\\$MTU" ] && [ "\\$MTU" != "0" ]; then
        nmcli connection modify "\\$VLAN_CON_NAME" 802.mtu "\\$MTU"
    fi

    nmcli connection up "\\$VLAN_CON_NAME"
else
    nmcli connection add type ethernet con-name "\\$INTERFACE" ifname "\\$INTERFACE" ipv4.method manual ipv4.addresses "\\$PUBLIC_IP" ipv4.gateway "\\$GATEWAY_IP" ipv4.dns "8.8.8.8,8.8.4.4" connection.autoconnect yes

    if [ -n "\\$MTU" ] && [ "\\$MTU" != "0" ]; then
        nmcli connection modify "\\$INTERFACE" 802-3-ethernet.mtu "\\$MTU"
    fi

    nmcli connection up "\\$INTERFACE"
fi

systemctl disable network-migration.service 2>/dev/null || true
systemctl daemon-reload 2>/dev/null || true
#rm -f /etc/systemd/system/network-migration.service
#rm -f /usr/local/bin/network-migration.sh
EOF

chmod +x /usr/local/bin/network-migration.sh
systemctl daemon-reload 2>/dev/null || true
systemctl enable network-migration.service

dnf -y update
dnf -y remove cockpit-ws

tee /etc/ssh/sshd_config.d/90-cloud.conf << EOF
PermitRootLogin no
PasswordAuthentication no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
EOF

useradd -G adm,video,wheel,systemd-journal cloud || true
#passwd -d root
#passwd -l root
passwd -d cloud
passwd -l cloud
mkdir -p /home/cloud/.ssh
chown cloud:cloud /home/cloud/.ssh
restorecon -v /home/cloud/.ssh
chmod 700 /home/cloud/.ssh
tee /etc/sudoers.d/wheel << EOF
%wheel ALL=(ALL) NOPASSWD:ALL
EOF
chmod 440 /etc/sudoers.d/wheel

tee /home/cloud/.ssh/authorized_keys << '|SSH-EOF|'
${sshKeys}
|SSH-EOF|
chown cloud:cloud /home/cloud/.ssh/authorized_keys
restorecon -v /home/cloud/.ssh/authorized_keys
chmod 600 /home/cloud/.ssh/authorized_keys

systemctl enable sshd
systemctl restart sshd
systemctl disable firewalld
systemctl stop firewalld
systemctl start chronyd
systemctl enable chronyd
%end
`
}
