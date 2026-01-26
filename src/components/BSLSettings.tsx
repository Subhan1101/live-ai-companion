import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  AlignStartVertical, 
  AlignEndVertical, 
  Maximize2, 
  Minimize2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BSLSettingsState {
  speed: number;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  isCompact: boolean;
  autoPlay: boolean;
}

interface BSLSettingsProps {
  settings: BSLSettingsState;
  onSettingsChange: (settings: BSLSettingsState) => void;
  onClose: () => void;
}

const positionOptions: { value: BSLSettingsState['position']; icon: React.ReactNode; label: string }[] = [
  { value: 'top-left', icon: <AlignStartVertical className="w-3 h-3 rotate-90" />, label: 'TL' },
  { value: 'top-right', icon: <AlignEndVertical className="w-3 h-3 rotate-90" />, label: 'TR' },
  { value: 'bottom-left', icon: <AlignStartVertical className="w-3 h-3 -rotate-90" />, label: 'BL' },
  { value: 'bottom-right', icon: <AlignEndVertical className="w-3 h-3 -rotate-90" />, label: 'BR' },
];

export const BSLSettings = ({ settings, onSettingsChange, onClose }: BSLSettingsProps) => {
  const updateSetting = <K extends keyof BSLSettingsState>(
    key: K,
    value: BSLSettingsState[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="p-3 bg-muted/30 border-b border-border/50 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Settings</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4"
          onClick={onClose}
        >
          <X className="w-2.5 h-2.5" />
        </Button>
      </div>

      {/* Speed control */}
      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground">Speed: {settings.speed}x</Label>
        <Slider
          value={[settings.speed]}
          onValueChange={([value]) => updateSetting('speed', value)}
          min={0.5}
          max={2}
          step={0.25}
          className="h-4"
        />
      </div>

      {/* Position selector */}
      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground">Position</Label>
        <div className="grid grid-cols-4 gap-1">
          {positionOptions.map((option) => (
            <Button
              key={option.value}
              variant={settings.position === option.value ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-6 px-1 text-[9px]',
                settings.position === option.value && 'bg-primary text-primary-foreground'
              )}
              onClick={() => updateSetting('position', option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Size toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
          {settings.isCompact ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          {settings.isCompact ? 'Compact' : 'Full'}
        </Label>
        <Switch
          checked={!settings.isCompact}
          onCheckedChange={(checked) => updateSetting('isCompact', !checked)}
          className="scale-75"
        />
      </div>

      {/* Auto-play toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">Auto-play</Label>
        <Switch
          checked={settings.autoPlay}
          onCheckedChange={(checked) => updateSetting('autoPlay', checked)}
          className="scale-75"
        />
      </div>
    </div>
  );
};

export default BSLSettings;
