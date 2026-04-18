import { useEffect } from "react";

type NotificationEvent =
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

function formatEvent(event: NotificationEvent): {
	title: string;
	body: string;
	tag: string;
} {
	switch (event.type) {
		case "idle":
			return {
				title: `Claudeが停止: ${event.title}`,
				body: "入力待ち or タスク完了の可能性",
				tag: `plx-idle-${event.ticketId}-${event.at}`,
			};
		case "error":
			return {
				title: `エラー: ${event.title}`,
				body: "Claude接続失敗。tmux kill-server で復旧",
				tag: `plx-error-${event.ticketId}-${event.at}`,
			};
		case "pr_created":
			return {
				title: `PR作成: ${event.title}`,
				body: event.url,
				tag: `plx-pr-${event.ticketId}`,
			};
		case "stopped":
			return {
				title: `セッション終了: ${event.title}`,
				body: "tmuxセッションが消えました",
				tag: `plx-stopped-${event.ticketId}-${event.at}`,
			};
	}
}

function showNotification(event: NotificationEvent): void {
	if (typeof Notification === "undefined") return;
	if (Notification.permission !== "granted") return;
	if (document.visibilityState === "visible" && event.type === "pr_created") {
		// PRはタブ表示中でも通知したい
	} else if (document.visibilityState === "visible") {
		// 他はタブ表示中ならブラウザ通知不要 (UI側で見えるため)
		return;
	}
	const { title, body, tag } = formatEvent(event);
	try {
		const n = new Notification(title, { body, tag });
		if (event.type === "pr_created" && event.url) {
			n.onclick = () => {
				window.open(event.url, "_blank");
				n.close();
			};
		}
	} catch (err) {
		console.warn("Notification failed:", err);
	}
}

export function useBrowserNotifications(
	onEvent?: (event: NotificationEvent) => void,
): void {
	useEffect(() => {
		if (typeof Notification !== "undefined" && Notification.permission === "default") {
			Notification.requestPermission();
		}

		const es = new EventSource("/api/events");
		es.onmessage = (ev) => {
			try {
				const event = JSON.parse(ev.data) as NotificationEvent;
				showNotification(event);
				onEvent?.(event);
			} catch (err) {
				console.warn("Failed to parse event:", err);
			}
		};
		es.onerror = () => {
			// EventSource auto-reconnects
		};
		return () => es.close();
	}, [onEvent]);
}
