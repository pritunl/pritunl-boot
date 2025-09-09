export class SyncInterval {
	private timer: number | null = null;
	private cancel: boolean = false;
	private readonly interval: number;
	private readonly action: () => Promise<any>;

	constructor(action: () => Promise<any>, interval: number) {
		this.action = action;
		this.interval = interval;
		this.start();
	}

	public start = async (): Promise<void> => {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		this.cancel = false;

		const runSync = async (): Promise<void> => {
			if (this.cancel) return;

			try {
				await this.action();

				if (!this.cancel) {
					this.timer = window.setTimeout(() => {
						runSync();
					}, this.interval);
				}
			} catch (error) {
				console.error("Action error:", error);
				if (!this.cancel) {
					this.timer = window.setTimeout(() => {
						runSync();
					}, this.interval);
				}
			}
		};

		this.timer = window.setTimeout(() => {
			runSync();
		}, this.interval);
	};

	public stop = (): void => {
		this.cancel = true;
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	};
}
