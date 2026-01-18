import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type VoiceOption = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

interface VoiceSelectorProps {
  currentVoice: VoiceOption;
  onVoiceChange: (voice: VoiceOption) => void;
  disabled?: boolean;
}

const voiceOptions: { value: VoiceOption; label: string; description: string }[] = [
  { value: "nova", label: "Nova", description: "Energetic female" },
  { value: "shimmer", label: "Shimmer", description: "Soft female" },
  { value: "alloy", label: "Alloy", description: "Neutral balanced" },
  { value: "echo", label: "Echo", description: "Warm male" },
  { value: "fable", label: "Fable", description: "British accent" },
  { value: "onyx", label: "Onyx", description: "Deep male" },
];

const VoiceSelector = ({ currentVoice, onVoiceChange, disabled }: VoiceSelectorProps) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap">Voice:</span>
      <Select
        value={currentVoice}
        onValueChange={(value) => onVoiceChange(value as VoiceOption)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs bg-card border-border">
          <SelectValue placeholder="Select voice" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border z-50">
          {voiceOptions.map((voice) => (
            <SelectItem key={voice.value} value={voice.value} className="text-xs">
              <div className="flex flex-col">
                <span className="font-medium">{voice.label}</span>
                <span className="text-muted-foreground text-[10px]">{voice.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default VoiceSelector;
