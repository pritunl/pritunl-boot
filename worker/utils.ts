import * as Types from "./types"

const idChars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const idCharsLen = idChars.length
const safeCharsRe = /[A-Za-z0-9+/=\s\t@.#_-]/g;

export function encodeBase64(data: string): string {
	const encoder = new TextEncoder()
	const encoded = encoder.encode(data)
	return btoa(String.fromCharCode(...encoded))
}

export function decodeBase64(data: string): string {
	const decoded = atob(data)
	const decoder = new TextDecoder()
	const uint8Array = new Uint8Array([...decoded].map(x => x.charCodeAt(0)))
	return decoder.decode(uint8Array)
}

export function filterString(input: string): string {
	input = input.replace("SSH-EOF", "")
	return input.match(safeCharsRe)?.join("") || ""
}

export function generateId(length = 10): string {
	const array = new Uint8Array(length)
	crypto.getRandomValues(array)
	return Array.from(array, byte => idChars[byte % idCharsLen]).join("")
}

export function cidrToNetmask(cidr: string): string {
		const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
		if (!cidrRegex.test(cidr)) {
				throw new Error('Invalid CIDR format. Expected format: x.x.x.x/y')
		}

		const prefixLength = parseInt(cidr.split('/')[1])
		if (prefixLength < 0 || prefixLength > 32) {
				throw new Error('Invalid prefix length. Must be between 0 and 32')
		}

		const mask = (0xFFFFFFFF << (32 - prefixLength)) >>> 0

		const octet1 = (mask >>> 24) & 0xFF
		const octet2 = (mask >>> 16) & 0xFF
		const octet3 = (mask >>> 8) & 0xFF
		const octet4 = mask & 0xFF

		return `${octet1}.${octet2}.${octet3}.${octet4}`
}

export function cidrToIp(cidr: string): string {
	return cidr.split('/')[0]
}

export function generateIpxe(data: Types.Register): string {
	return `#!ipxe
kernel http://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/images/pxeboot/vmlinuz inst.repo=https://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/ inst.ks=http://boot.pritunl.com/${data.id}.ks modprobe.blacklist=rndis_host net.ifnames=0 biosdevname=0 ${getKernelNetwork(data)}
initrd http://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/images/pxeboot/initrd.img
boot
`
}

function getKernelNetwork(data: Types.Register): string {
	const publicIp = cidrToIp(data.public_ip)
	const netmask = cidrToNetmask(data.public_ip)
	let iface = data.interface || data.interface1
	if (data.vlan != 0) {
		iface += `.${data.vlan}`
	}

	return `ip=${publicIp}::${data.gateway_ip}:${netmask}::${iface}:off:8.8.8.8`
}

export function generateKickstart(data: Types.Register): string {
	const sshKeys = decodeBase64(data.ssh_keys)
	const publicIp = cidrToIp(data.public_ip)

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
