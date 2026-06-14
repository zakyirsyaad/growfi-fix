"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { gameEventBus } from "@/lib/game/eventBus";
import { sendLocalChatMessage } from "@/lib/realtime/socketClient";
import type { ChatMessagePayload } from "@/lib/realtime/types";

export function LocalChatOverlay({
  open,
  onOpenChange,
  room,
  messages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: string;
  messages: ChatMessagePayload[];
}) {
  const [message, setMessage] = useState("");
  const roomMessages = useMemo(
    () => messages.filter((item) => item.room === room).slice(-50),
    [messages, room],
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
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Local Chat"
      description={room}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          {roomMessages.length === 0 ? (
            <div className="pixel-card p-4 text-sm text-[#91d985]">
              No messages yet.
            </div>
          ) : (
            roomMessages.map((item) => (
              <div key={item.id} className="pixel-card flex gap-3 p-3">
                <Avatar className="h-8 w-8 rounded-md">
                  <AvatarImage src={item.from.avatarUrl || undefined} />
                  <AvatarFallback className="rounded-md">
                    {item.from.username.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#f2fbf1]">
                      {item.from.username}
                    </span>
                    <span className="text-xs text-[#5e8c52]">
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="break-words text-sm text-[#ddf5d9]">
                    {item.message}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={message}
            maxLength={180}
            placeholder="Message nearby farmers"
            className="pixel-input px-3 py-2"
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
          <button
            type="button"
            className="pixel-btn pixel-btn-primary px-3 py-2"
            onClick={send}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </ResponsivePanel>
  );
}
