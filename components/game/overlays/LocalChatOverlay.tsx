"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { gameEventBus } from "@/lib/game/eventBus";
import { sendLocalChatMessage } from "@/lib/realtime/socketClient";
import type { ChatMessagePayload } from "@/lib/realtime/types";

export function LocalChatOverlay({
  open,
  onOpenChange,
  room,
  messages
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: string;
  messages: ChatMessagePayload[];
}) {
  const [message, setMessage] = useState("");
  const roomMessages = useMemo(
    () => messages.filter((item) => item.room === room).slice(-50),
    [messages, room]
  );

  const send = () => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    sendLocalChatMessage(trimmed, room);
    setMessage("");
  };

  return (
    <ResponsivePanel open={open} onOpenChange={onOpenChange} title="Local Chat" description={room}>
      <div className="space-y-3">
        <div className="space-y-2">
          {roomMessages.length === 0 ? (
            <Card className="bg-white/82">
              <CardContent className="p-4 text-sm text-muted-foreground">No messages yet.</CardContent>
            </Card>
          ) : (
            roomMessages.map((item) => (
              <Card key={item.id} className="bg-white/82">
                <CardContent className="flex gap-3 p-3">
                  <Avatar className="h-8 w-8 rounded-md">
                    <AvatarImage src={item.from.avatarUrl || undefined} />
                    <AvatarFallback className="rounded-md">
                      {item.from.username.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{item.from.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="break-words text-sm">{item.message}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={message}
            maxLength={180}
            placeholder="Message nearby farmers"
            onFocus={() =>
              gameEventBus.emit("gameInputLockChanged", {
                source: "local-chat",
                locked: true,
              })
            }
            onBlur={() =>
              gameEventBus.emit("gameInputLockChanged", {
                source: "local-chat",
                locked: false,
              })
            }
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                send();
              }
            }}
          />
          <Button size="icon" onClick={send}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </ResponsivePanel>
  );
}
