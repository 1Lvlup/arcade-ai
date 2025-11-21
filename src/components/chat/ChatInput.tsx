import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Paperclip, X, ImageIcon } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled: boolean;
  selectedImages: File[];
  imagePreviewUrls: string[];
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onKeyDown,
  disabled,
  selectedImages,
  imagePreviewUrls,
  onImageSelect,
  onRemoveImage,
  fileInputRef,
}: ChatInputProps) {
  return (
    <div className="border-t border-white/10 p-4 flex-shrink-0 bg-black">
      {/* Image Preview */}
      {imagePreviewUrls.length > 0 && (
        <div className="mb-3 flex gap-2 flex-wrap">
          {imagePreviewUrls.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Preview ${index + 1}`}
                className="w-20 h-20 object-cover rounded border border-white/20"
              />
              <button
                onClick={() => onRemoveImage(index)}
                className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={onImageSelect}
          accept="image/*"
          multiple
          className="hidden"
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-white/5"
          title="Attach images"
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about this game..."
          disabled={disabled}
          className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
        />

        <Button
          onClick={onSend}
          disabled={disabled || (!value.trim() && selectedImages.length === 0)}
          className="flex-shrink-0 bg-gradient-to-r from-orange to-orange-light hover:opacity-90"
        >
          <Send className="h-4 w-4 mr-2" />
          Send
        </Button>
      </div>

      {selectedImages.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          <ImageIcon className="h-3 w-3" />
          {selectedImages.length} image{selectedImages.length > 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}
