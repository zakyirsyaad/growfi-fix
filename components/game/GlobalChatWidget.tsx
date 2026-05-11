"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Minus, Send, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { gameEventBus } from "@/lib/game/eventBus";
import {
  getRealtimeSocketStatus,
  joinGlobalChat,
  sendGlobalChatMessage,
  type RealtimeConnectionStatus,
} from "@/lib/realtime/socketClient";
import type { GlobalChatMessagePayload } from "@/lib/realtime/types";

function ChatMessages({ messages }: { messages: GlobalChatMessagePayload[] }) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <ScrollArea className="h-[280px] pr-3">
      <div className="space-y-2">
        {messages.length === 0 ? (
          <div className="rounded-md bg-muted p-3 text-sm font-semibold text-muted-foreground">
            No global messages yet.
          </div>
        ) : (
          messages.map((item) => (
            <div key={item.id} className="flex gap-2 rounded-md bg-white/75 p-2">
              <Avatar className="h-8 w-8 rounded-md">
                <AvatarImage src={item.from.avatarUrl || undefined} />
                <AvatarFallback className="rounded-md">
                  {item.from.username.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold">
                    {item.from.username}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="break-words text-sm">{item.message}</div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function ChatInput({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (message: string) => void;
}) {
  const [message, setMessage] = useState("");

  const send = () => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    onSend(trimmed);
    setMessage("");
  };

  return (
    <div className="flex gap-2">
      <Input
        value={message}
        maxLength={240}
        disabled={disabled}
        placeholder={disabled ? "Reconnecting..." : "Message global chat"}
        onFocus={() =>
          gameEventBus.emit("gameInputLockChanged", {
            source: "global-chat",
            locked: true,
          })
        }
        onBlur={() =>
          gameEventBus.emit("gameInputLockChanged", {
            source: "global-chat",
            locked: false,
          })
        }
        onKeyDownCapture={(event) => event.stopPropagation()}
        onKeyUpCapture={(event) => event.stopPropagation()}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            send();
          }
        }}
      />
      <Button size="icon" disabled={disabled || !message.trim()} onClick={send}>
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function GlobalChatWidget() {
  const mobile = useMediaQuery("(max-width: 767px)");
  const initialSocketStatus = getRealtimeSocketStatus();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(true);
  const [socketState, setSocketState] = useState<{
    connected: boolean;
    status: RealtimeConnectionStatus;
    message?: string;
    url?: string;
  }>({
    connected: initialSocketStatus.connected,
    status: initialSocketStatus.status,
    message: initialSocketStatus.message,
    url: initialSocketStatus.url,
  });
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState<GlobalChatMessagePayload[]>([]);
  const visible = mobile ? open : !minimized;

  useEffect(() => {
    const cleanup = gameEventBus.on("socketReady", (next) => {
      const status =
        next.status || (next.connected ? "connected" : "disconnected");
      setSocketState({ ...next, status });
      if (next.connected) {
        setError(null);
        joinGlobalChat();
      } else if (status === "error") {
        setError(next.message || "Could not connect to realtime chat.");
      }
    });
    joinGlobalChat();
    setSocketState(getRealtimeSocketStatus());
    return () => {
      cleanup();
      gameEventBus.emit("gameInputLockChanged", {
        source: "global-chat",
        locked: false,
      });
    };
  }, []);

  useEffect(() => {
    const cleanups = [
      gameEventBus.on("globalChatHistory", ({ messages: history }) => {
        setMessages(history.slice(-100));
      }),
      gameEventBus.on("globalChatMessage", (message) => {
        setMessages((current) => [...current, message].slice(-100));
        if (!visible) {
          setUnread((current) => current + 1);
        }
      }),
      gameEventBus.on("globalChatError", ({ message }) => {
        setError(message);
      }),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setUnread(0);
    }
  }, [visible]);

  const status = useMemo(
    () =>
      socketState.connected
        ? "Connected"
        : socketState.status === "error"
        ? "Error"
        : socketState.status === "disconnected"
        ? "Disconnected"
        : socketState.status === "connecting"
        ? "Connecting"
        : "Reconnecting",
    [socketState.connected, socketState.status]
  );
  const connected = socketState.connected;

  const body = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={connected ? "outline" : "secondary"}>
          Global Chat · {status}
        </Badge>
        {error ? (
          <span className="text-xs font-semibold text-destructive">
            {error}
            {process.env.NODE_ENV === "development" && socketState.url
              ? ` (${socketState.url})`
              : ""}
          </span>
        ) : null}
      </div>
      <ChatMessages messages={messages} />
      <ChatInput
        disabled={!connected}
        onSend={(message) => {
          setError(null);
          sendGlobalChatMessage(message);
        }}
      />
    </div>
  );

  if (mobile) {
    return (
      <>
        <Button
          className="pointer-events-auto fixed bottom-5 right-5 z-40 rounded-full shadow-lg"
          size="icon"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="h-5 w-5" />
          {unread > 0 ? (
            <Badge className="absolute -right-2 -top-2 h-5 min-w-5 px-1">
              {unread}
            </Badge>
          ) : null}
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-[76svh]">
            <SheetHeader>
              <SheetTitle>Global Chat</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{body}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (minimized) {
    return (
      <Button
        className="pointer-events-auto fixed bottom-5 right-5 z-40 shadow-lg"
        onClick={() => setMinimized(false)}
      >
        <MessageCircle className="h-4 w-4" />
        Global Chat
        {unread > 0 ? <Badge variant="secondary">{unread}</Badge> : null}
      </Button>
    );
  }

  return (
    <Card className="pointer-events-auto fixed bottom-5 right-5 z-40 w-[360px] bg-white/94 shadow-xl backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Global Chat</CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setMinimized(true)}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMinimized(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
