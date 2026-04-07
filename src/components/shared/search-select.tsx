"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "./command";

export interface SearchSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface SearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  emptyText?: string;
}

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Chọn...",
  searchPlaceholder = "Tìm kiếm...",
  disabled = false,
  className,
  emptyText = "Không tìm thấy.",
}: SearchSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between h-9 px-3 rounded-md border border-border bg-secondary text-sm text-left",
            "focus:border-primary focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {selected ? (
              <>
                {selected.label}
                {selected.sublabel && <span className="ml-1 text-muted-foreground">— {selected.sublabel}</span>}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.sublabel || ""}`}
                  onSelect={() => {
                    onChange(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === option.value ? "opacity-100" : "opacity-0")} />
                  <span>{option.label}</span>
                  {option.sublabel && <span className="ml-1 text-muted-foreground">— {option.sublabel}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
