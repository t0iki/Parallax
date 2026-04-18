import { EventEmitter } from "node:events";

export type NotificationEvent =
	| {
			type: "idle";
			ticketId: string;
			sessionName: string;
			title: string;
			at: number;
	  }
	| {
			type: "error";
			ticketId: string;
			sessionName: string;
			title: string;
			at: number;
	  }
	| {
			type: "pr_created";
			ticketId: string;
			sessionName: string;
			title: string;
			url: string;
			at: number;
	  }
	| {
			type: "stopped";
			ticketId: string;
			sessionName: string;
			title: string;
			at: number;
	  };

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export function emitNotification(event: NotificationEvent): void {
	emitter.emit("notification", event);
}

export function subscribeNotifications(
	cb: (event: NotificationEvent) => void,
): () => void {
	emitter.on("notification", cb);
	return () => {
		emitter.off("notification", cb);
	};
}
