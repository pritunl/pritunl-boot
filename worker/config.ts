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
		kernel_hash: "1e93b0129511f8fcea90b2c32f1eb554d9014b3b0b66e2cdb30cea6e3f230dee",
		initrd_url: "https://repo.almalinux.org/almalinux/10/BaseOS/x86_64/os/images/pxeboot/initrd.img",
		initrd_hash: "27bd2b2003c2970ea94eb44318d9e24d2858725340e8fff7536960c21c35a3a8",
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
}
