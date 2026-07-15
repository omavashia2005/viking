import React, { useState } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/src/components/ai-elements/model-selector";
import { Button } from "./ui/button";

const MODELS = [
  { id: "anthropic/claude-opus-4.8", name: "Claude Opus 4.8", provider: "Anthropic", logo: "anthropic" },
  { id: "openai/gpt-5.6-sol", name: "GPT-5.6 Sol", provider: "OpenAI", logo: "openai" },
  { id: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash", provider: "Google", logo: "google" },
  { id: "xai/grok-4.5", name: "Grok 4.5", provider: "xAI", logo: "xai" },
] as const;

export function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const selected = MODELS.find(model => model.id === value);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] lowercase tracking-[0.16em] text-muted-foreground">
        model
      </span>
      <ModelSelector
        open={open}
        onOpenChange={setOpen}
      >
        <ModelSelectorTrigger asChild>
          <Button
            autoFocus
            variant="outline"
            className="h-auto w-full justify-start rounded-lg bg-black/20 p-3 text-left font-normal"
          >
            {selected && <ModelSelectorLogo provider={selected.logo} className="size-6" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{selected?.name ?? (value || "Choose a model")}</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {selected ? `${selected.provider} · ${selected.id}` : "Vercel AI Gateway"}
              </span>
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
          </Button>
        </ModelSelectorTrigger>
        <ModelSelectorContent title="Choose a model">
          <ModelSelectorInput autoFocus placeholder="Search models…" />
          <ModelSelectorList>
            <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
            <ModelSelectorGroup heading="AI Gateway models">
              {MODELS.map(model => (
                <ModelSelectorItem
                  key={model.id}
                  value={`${model.name} ${model.provider} ${model.id}`}
                  onSelect={() => {
                    onChange(model.id);
                    setOpen(false);
                  }}
                >
                  <ModelSelectorLogo provider={model.logo} className="size-5" />
                  <span className="min-w-0 flex-1">
                    <ModelSelectorName>{model.name}</ModelSelectorName>
                    <span className="block truncate text-[10px] text-muted-foreground">{model.provider} · {model.id}</span>
                  </span>
                  {model.id === value && <CheckIcon className="size-4" />}
                </ModelSelectorItem>
              ))}
            </ModelSelectorGroup>
          </ModelSelectorList>
        </ModelSelectorContent>
      </ModelSelector>
    </div>
  );
}
