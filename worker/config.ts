export const BaseUrl = "https://boot.pritunl.com"
export const BaseUrlInsecure = "http://boot.pritunl.com"

export interface Distro {
	repo_url: string
	repo_conf: string
	kernel_url: string
	kernel_hash: string
	initrd_url: string
	initrd_hash: string
	stage2_url?: string
	stage2_hash?: string
}

export const Distros: Record<string, Distro> = {
	"almalinux10": {
		repo_url: "https://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/",
		repo_conf: `url --url="https://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/"
repo --name="AppStream" --baseurl="https://repo.almalinux.org/almalinux/10/AppStream/x86_64/os/"`,
		kernel_url: "https://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/images/pxeboot/vmlinuz",
		kernel_hash: "90ee8394588e78eed5136fa484a2b49c6a9e70960356b046c1b90a5a6f449f7d",
		initrd_url: "https://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/images/pxeboot/initrd.img",
		initrd_hash: "e1b5b7f627a0d2982981521e3dd550a8f51e40d08b3e9318763d2c7ce273b3a9",
	},
	"oraclelinux10": {
		repo_url: "https://yum.oracle.com/repo/OracleLinux/OL10/baseos/latest/x86_64/",
		repo_conf: `url --url="https://yum.oracle.com/repo/OracleLinux/OL10/baseos/latest/x86_64/"
repo --name="ol10_UEKR8" --baseurl="https://yum.oracle.com/repo/OracleLinux/OL10/UEKR8/x86_64/"
repo --name="ol10_appstream" --baseurl="https://yum.oracle.com/repo/OracleLinux/OL10/appstream/x86_64/"`,
		kernel_url: "https://pxe.pritunl.com/oraclelinux10/images/pxeboot/vmlinuz",
		kernel_hash: "0d44c2bceb3e22a717cb264817db83f5f5ef837e4bab412b1a74453fb3e8df0a",
		initrd_url: "https://pxe.pritunl.com/oraclelinux10/images/pxeboot/initrd.img",
		initrd_hash: "d75f1a5ff65b5837a92402ac2402e915a43e7dedbe9f489e24248254a9677577",
		stage2_url: "https://pxe.pritunl.com/oraclelinux10",
		stage2_hash: "dc4537c3f2bc86c29d58be161dcc74e8bb1e0277f0ebe2afebc8d51182395a47",
	},
	"rockylinux10": {
		repo_url: "https://dl.rockylinux.org/pub/rocky/10/BaseOS/x86_64/os/",
		repo_conf: `url --url="https://dl.rockylinux.org/pub/rocky/10/BaseOS/x86_64/os/"
repo --name="AppStream" --baseurl="https://dl.rockylinux.org/pub/rocky/10/AppStream/x86_64/os/"`,
		kernel_url: "https://dl.rockylinux.org/pub/rocky/10/BaseOS/x86_64/os/images/pxeboot/vmlinuz",
		kernel_hash: "1d3cca6870442d139785037fc67a780f26f391fcc3617b3686eec9da750acbbb",
		initrd_url: "https://dl.rockylinux.org/pub/rocky/10/BaseOS/x86_64/os/images/pxeboot/initrd.img",
		initrd_hash: "d29f598e370b097be550310f24462ffcd5645466da3b117124839c43d8c8a5f7",
	},
	"fedora": {
		repo_url: "https://iad.mirror.rackspace.com/fedora/releases/44/Server/x86_64/os/",
		repo_conf: `url --url="https://iad.mirror.rackspace.com/fedora/releases/44/Server/x86_64/os/"
repo --name="updates" --baseurl="https://iad.mirror.rackspace.com/fedora/updates/44/Everything/x86_64/"`,
		kernel_url: "https://iad.mirror.rackspace.com/fedora/releases/44/Server/x86_64/os/images/pxeboot/vmlinuz",
		kernel_hash: "4b37e4e542a62c580c751787848be6c99e6f908f6712c8c6da85516b8d541de2",
		initrd_url: "https://iad.mirror.rackspace.com/fedora/releases/44/Server/x86_64/os/images/pxeboot/initrd.img",
		initrd_hash: "dec8bd9bf9238a34c6b3df465ee4ebae16b5313560b5bc6bab817d3fb18fb0fc",
	},
}

export const IpxeUrl = "https://pxe.pritunl.com/ipxe.iso"
export const IpxeHash = "65c60cffe1f578ffa7ce909e3e1ac57fe7eae241cf274194b45d19c89f7391de"
