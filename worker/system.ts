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

export function generateKickstartNetwork(
	data: Types.Configuration, escape: boolean = true): string {

	let rootIface = ""
	let interfaceConf = ""
	let esc = escape ? "\\" : ""

	if (data.interfaces) {
		data.interfaces.forEach((iface: string, index: number) => {
			interfaceConf += `
INTERFACE${index}=${esc}$(get_iface_from_mac "${iface}")
if [ ${esc}$? -ne 0 ] || [ -z "${esc}$INTERFACE${index}" ]; then
    echo "Failed to find interface with MAC ${iface}"
    exit 1
fi`
		})
	} else {
		interfaceConf = `
INTERFACE=${esc}$(get_iface_from_mac "${esc}$MAC_ADDR")
if [ ${esc}$? -ne 0 ] || [ -z "${esc}$INTERFACE" ]; then
    echo "Failed to find interface with MAC ${esc}$MAC_ADDR"
    exit 1
fi`
	}

	let conf = `
get_iface_from_mac() {
    local mac="${esc}$1"
    mac=${esc}$(echo "${esc}$mac" | tr '[:upper:]' '[:lower:]')
    interface=${esc}$(ip -br link show | grep -i "${esc}$mac" | awk '{print ${esc}$1}')
    if [ -z "${esc}$interface" ]; then
        echo "No interface found with MAC ${esc}$mac"
        return 1
    fi
    echo "${esc}$interface"
}
${interfaceConf}

nmcli general hostname cloud

nmcli -g UUID connection show | while read connid; do
    nmcli connection delete "${esc}$connid"
done

sleep 1`

	if (data.bonded_network && data.interfaces && data.interfaces.length >= 2) {
		rootIface = "bond0"
		let bondOpts = "mode=802.3ad,lacp_rate=fast,miimon=100,xmit_hash_policy=layer3+4"
		if (data.mtu) {
			bondOpts += `,mtu=${data.mtu}`
		}

		conf += `
nmcli connection add type bond con-name ${rootIface} ifname ${rootIface} bond.options ${bondOpts}`
		data.interfaces.forEach((_iface: string, index: number) => {
			conf += `
nmcli connection add type bond-slave con-name bond0-slave${index} ifname "${esc}$INTERFACE${index}" master bond0`
		})
	} else {
		if (data.interfaces) {
			rootIface = `"${esc}$INTERFACE0"`
		} else {
			rootIface = `"${esc}$INTERFACE"`
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
nmcli connection modify ${vlanIface} mtu ${data.mtu}`
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
nmcli connection modify ${vlanIface6} mtu ${data.mtu}`
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
nmcli connection up ${vlanIface6}`
	}

	return conf
}

export function generateKickstart(data: Types.Configuration): string {
	const sshKeys = Utils.decodeBase64(data.ssh_keys)
	let publicMacFunc = ""
	if (data.network_mode === "static") {
		const publicIp = Utils.cidrToIp(data.public_ip)
		publicMacFunc = `get_mac_from_ip "${publicIp}"`
	} else {
		publicMacFunc = `get_active_mac`
	}

	const networkScript = generateKickstartNetwork(data, true)

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

get_active_mac() {
    local interface
    local mac
    interface=$(ip route show default | head -1 | grep -oP 'dev \\K\\w+')

    if [ -n "$interface" ]; then
        if ip link show "$interface" | grep -q "state UP"; then
            mac=$(ip link show "$interface" | awk '/link\\/ether/ {print $2}')
            if [ -n "$mac" ]; then
                echo "$mac"
                return 0
            fi
        fi
    fi

    interface=$(ip -br addr show | awk '
        $2 == "UP" && $3 != "" && $1 !~ /^lo/ {
            print $1
            exit
        }
    ')

    if [ -n "$interface" ]; then
        mac=$(ip link show "$interface" | awk '/link\\/ether/ {print $2}')
        if [ -n "$mac" ]; then
            echo "$mac"
            return 0
        fi
    fi

    echo "No active network interface found" >&2
    return 1
}

PUBLIC_MAC_ADDR=$(${publicMacFunc})

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
${networkScript}

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
set -x

echo "=== Scanning for install disks ==="

POST_DATA="kernel=$(uname -r)"

disk_index=0
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

    if [ $size -lt 33554432 ]; then
        echo "Ignoring $diskname too small"
        continue
    fi

    size_megabytes=$(((size * 512) / 1024 / 1024))
    model=$(
        cat $disk/device/model 2>/dev/null |
        sed 's/[[:space:]]*$//; s/[^a-zA-Z0-9_ ()-]//g' ||
        echo ""
    )
    serial=$(
        cat $disk/device/serial 2>/dev/null |
        sed 's/[[:space:]]*$//; s/[^a-zA-Z0-9_ ()-]//g' ||
        echo ""
    )

    POST_DATA+="&disk$disk_index.path=/dev/$diskname"
    POST_DATA+="&disk$disk_index.size=$size_megabytes"
    POST_DATA+="&disk$disk_index.model=$model"
    POST_DATA+="&disk$disk_index.serial=$serial"
    disk_index=$((disk_index + 1))
done

echo "=== Scanning Network Interfaces ==="

lspci_output=$(lspci -D)
net_index=0
for iface in /sys/class/net/*; do
    [ -e "$iface" ] || continue

    ifacename=$(basename $iface)

    [ "$ifacename" = "lo" ] && continue

    mac=$(cat $iface/address 2>/dev/null || echo "")
    iface_ip=$(
        ip -4 addr show $ifacename 2>/dev/null |
        grep inet | head -1 | awk '{print $2}' |
        cut -d'/' -f1 || echo ""
    )
    carrier=$(cat $iface/carrier 2>/dev/null || echo 0)

    model=""
    if [ -e "$iface/device/uevent" ]; then
        pci_slot=$(
            readlink -f $iface/device 2>/dev/null |
            grep -o '[0-9a-f]*:[0-9a-f]*:[0-9a-f]*\.[0-9a-f]*$'
        )
        if [ -n "$pci_slot" ]; then
            model=$(
                echo "$lspci_output" | grep "^$pci_slot" |
                sed 's/^[^:]*:[^:]*:[^:]*: //' |
                sed 's/[[:space:]]*$//; s/[^a-zA-Z0-9_ ()-]//g'
            )
            [ -z "$model" ] && model=""
        fi
    fi

    POST_DATA+="&net$net_index.mac=$mac"
    POST_DATA+="&net$net_index.ip=$iface_ip"
    POST_DATA+="&net$net_index.model=$model"
    net_index=$((net_index + 1))
done

echo "=== Sending system state ==="

curl -v -X POST --data "$POST_DATA" "https://boot.pritunl.com/${data.id}/system"

poll_disk_decode() {
    local url="https://boot.pritunl.com/${data.id}/disks"
    local max_wait=600
    local response_file=$(mktemp)

    echo "=== Waiting for disk configuration ===" >&2

    local count=0
    while [ $count -lt $max_wait ]; do
        count=$((count + 1))

        if curl -s -o "$response_file" -w "%{http_code}" "$url" | grep -q "200"; then
            local response=$(cat "$response_file" | sed 's/[[:space:]]*$//')
            rm -f "$response_file"

            if [ -n "$response" ]; then
                echo "$response"
                return $?
            fi
        fi

        if [ $((count % 30)) -eq 0 ]; then
            echo "Waiting for configuration..." >&2
        fi

        sleep 3
    done

    rm -f "$response_file"
    echo "Timeout waiting for configuration" >&2
    return 1
}

DISK_CONFIG=$(poll_disk_decode)
echo $DISK_CONFIG
if [ $? -ne 0 ] || [ -z "$DISK_CONFIG" ]; then
    echo "Failed to get disk configuration" >&2
    exit 1
fi

if [[ "$DISK_CONFIG" =~ ^([^:]+):([^:]+):(.+)$ ]]; then
    RAID="\${BASH_REMATCH[1]}"
    ROOT_SIZE="\${BASH_REMATCH[2]}"
    DISKS_STR="\${BASH_REMATCH[3]}"
else
    echo "Invalid disk configuration format: $DISK_CONFIG" >&2
    exit 1
fi
IFS=',' read -ra DISKS <<< "$DISKS_STR"

if [ -z "$ROOT_SIZE" ] || [ "$ROOT_SIZE" = "0" ]; then
    ROOT_SIZE="--size=2048"
else
    ROOT_SIZE="--maxsize=$ROOT_SIZE"
fi

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
part raid.21 --ondisk=\${DISKS[0]} $ROOT_SIZE --grow
part raid.22 --ondisk=\${DISKS[1]} $ROOT_SIZE --grow
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
part raid.21 --ondisk=\${DISKS[0]} $ROOT_SIZE --grow
part raid.22 --ondisk=\${DISKS[1]} $ROOT_SIZE --grow
part raid.23 --ondisk=\${DISKS[2]} $ROOT_SIZE --grow
part raid.24 --ondisk=\${DISKS[3]} $ROOT_SIZE --grow
raid /boot/efi --level=1 --device=md0 raid.11 raid.12 --fstype="efi" --fsoptions="umask=0077,shortname=winnt"
raid / --level=10 --device=md1 raid.21 raid.22 raid.23 raid.24 --fstype="xfs"
EOF
else
    tee /tmp/storage.ks << EOF
ignoredisk --only-use=\${DISKS[0]}
clearpart --all --initlabel
part biosboot --ondisk=\${DISKS[0]} --size=1 --fstype="biosboot"
part /boot/efi --fstype="efi" --ondisk=\${DISKS[0]} --size=100 --fsoptions="umask=0077,shortname=winnt"
part / --fstype="xfs" --ondisk=\${DISKS[0]} $ROOT_SIZE --grow
EOF
fi
%end

%post --log=/root/ks-post.log
#!/bin/bash
set -x
echo "=== Running post setup ==="

grubby --update-kernel=ALL --remove-args="crashkernel net.ifnames biosdevname"

poll_network_decode() {
    local url="https://boot.pritunl.com/${data.id}/network"
    local max_wait=10
    local response_file=$(mktemp)

    echo "=== Waiting for network configuration ===" >&2

    local count=0
    while [ $count -lt $max_wait ]; do
        count=$((count + 1))

        if curl -s -o "$response_file" -w "%{http_code}" "$url" | grep -q "200"; then
            local response=$(cat "$response_file")
            rm -f "$response_file"

            if [ -n "$response" ]; then
                echo "$response" | base64 -d 2>/dev/null
                return $?
            fi
        fi

        sleep 3
    done

    rm -f "$response_file"
    echo "Timeout waiting for configuration" >&2
    return 1
}

NETWORK_CONFIG=$(poll_network_decode)
if [ $? -ne 0 ] || [ -z "$NETWORK_CONFIG" ]; then
    echo "Failed to get network configuration" >&2
    exit 1
fi

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
$NETWORK_CONFIG

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
