import React, { useState } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/src/components/ai-elements/model-selector";
import { Button } from "./ui/button";

export function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const model = query.trim();

  const selectModel = (): void => {
    if (!model) return;
    onChange(model);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] lowercase tracking-[0.16em] text-muted-foreground">
        model
      </span>
      <ModelSelector
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setQuery(value);
        }}
      >
        <ModelSelectorTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between bg-black/20 font-normal"
          >
            <span className="truncate">{value || "choose a model"}</span>
            <ChevronsUpDownIcon className="size-4 opacity-50" />
          </Button>
        </ModelSelectorTrigger>
        <ModelSelectorContent title="Choose a model">
          <ModelSelectorInput
            autoFocus
            placeholder="Type a model ID…"
            value={query}
            onValueChange={setQuery}
          />
          <ModelSelectorList>
            {model && (
              <ModelSelectorGroup heading="Model ID">
                <ModelSelectorItem value={model} onSelect={selectModel}>
                  <ModelSelectorName>{model}</ModelSelectorName>
                  {model === value && <CheckIcon className="size-4" />}
                </ModelSelectorItem>
              </ModelSelectorGroup>
            )}
          </ModelSelectorList>
        </ModelSelectorContent>
      </ModelSelector>
    </div>
  );
}
