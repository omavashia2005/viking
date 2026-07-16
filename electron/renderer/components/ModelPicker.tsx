import React, { useEffect, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import type { GatewayModel } from "@/shared-types";
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
} from "@/electron/renderer/components/ai-elements/model-selector";
import { Button } from "./ui/button";

function providerName(provider: string): string {
  if (provider === "openai") return "OpenAI";
  if (provider === "xai") return "xAI";
  return provider.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<GatewayModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const fallbackProvider = value.split("/")[0] || "vercel";
  const fallbackName = value.split("/").pop() || value;
  const selected = models.find(model => model.id === value) ?? (value
    ? { id: value, name: fallbackName, provider: fallbackProvider }
    : undefined);

  useEffect(() => {
    let active = true;
    window.viking.getModels()
      .then(next => { if (active) setModels(next); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

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
            className="h-auto w-full justify-start rounded-lg bg-secondary p-3 text-left font-normal"
          >
            {selected && <ModelSelectorLogo provider={selected.provider} className="size-6" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{selected?.name ?? (value || "Choose a model")}</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {selected ? `${providerName(selected.provider)} · ${selected.id}` : "Vercel AI Gateway"}
              </span>
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
          </Button>
        </ModelSelectorTrigger>
        <ModelSelectorContent title="Choose a model">
          <ModelSelectorInput autoFocus placeholder="Search models…" />
          <ModelSelectorList>
            <ModelSelectorEmpty>{loading ? "Loading models…" : failed ? "Could not load model catalog." : "No models found."}</ModelSelectorEmpty>
            <ModelSelectorGroup heading={`AI Gateway models · ${models.length}`}>
              {models.map(model => (
                <ModelSelectorItem
                  key={model.id}
                  value={`${model.name} ${model.provider} ${model.id}`}
                  onSelect={() => {
                    onChange(model.id);
                    setOpen(false);
                  }}
                >
                  <ModelSelectorLogo provider={model.provider} className="size-5" />
                  <span className="min-w-0 flex-1">
                    <ModelSelectorName>{model.name}</ModelSelectorName>
                    <span className="block truncate text-[10px] text-muted-foreground">{providerName(model.provider)} · {model.id}</span>
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
