import { useState } from "react";
import { ChevronDown, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface SimliFace {
  id: string;
  name: string;
}

export const SIMLI_PRESET_FACES: SimliFace[] = [
  { id: "cace3ef7-a4c4-425d-a8cf-a5358eb0c427", name: "Tina" },
  { id: "b9e5fba3-071a-4e35-896e-211c4d6eaa7b", name: "Laila" },
  { id: "d2a5c7c6-fed9-4f55-bcb3-062f7cd20103", name: "Kate" },
  { id: "7e74d6e7-d559-4394-bd56-4923a3ab75ad", name: "Sabour" },
  { id: "1c6aa65c-d858-4721-a4d9-bda9fde03141", name: "Fred" },
  { id: "5fc23ea5-8175-4a82-aaaf-cdd8c88543dc", name: "Madison" },
  { id: "804c347a-26c9-4dcf-bb49-13df4bed61e8", name: "Mark" },
  { id: "afdb6a3e-3939-40aa-92df-01604c23101c", name: "Zahra" },
  { id: "9d0ba12e-ebad-4bfa-b1fb-c6c5be21abca", name: "Teenager" },
  { id: "dd10cb5a-d31d-4f12-b69f-6db3383c006e", name: "Hank" },
  { id: "c65af549-9105-442a-92a3-dc6c89e34149", name: "DJ" },
  { id: "f0ba4efe-7946-45de-9955-c04a04c367b9", name: "Doctor" },
  { id: "b1f6ad8f-ed78-430b-85ef-2ec672728104", name: "Charlotte" },
  { id: "c295e3a2-ed11-48d5-a1bd-ff42ac7eac73", name: "Einstein" },
  { id: "4cce0ca0-550f-42d8-b500-834ffb35e0af", name: "Catgirl" },
  { id: "c7451e55-ea04-41c8-ab47-bdca3e4a03d8", name: "Cleopatra" },
  { id: "14de6eb1-0ea6-4fde-9522-8552ce691cb6", name: "Baby" },
  { id: "6926a39d-638b-49c5-9328-79efa034e9a4", name: "Big Foot" },
  { id: "c2f1d5d7-074b-405d-be4c-df52cd52166a", name: "Nonna" },
  { id: "121cd5ae-7df7-4ea3-a389-401a9463db52", name: "Edna" },
  { id: "f1abe833-b44c-4650-a01c-191b9c3c43b8", name: "Tony" },
  { id: "tmp9i8bbq7c", name: "Jenna" },
];

interface FaceSelectorProps {
  currentFaceId: string;
  currentName: string;
  onFaceChange: (faceId: string, name: string) => void;
  disabled?: boolean;
}

export const FaceSelector = ({
  currentFaceId,
  currentName,
  onFaceChange,
  disabled,
}: FaceSelectorProps) => {
  const [customId, setCustomId] = useState("");
  const [customName, setCustomName] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handlePresetSelect = (face: SimliFace) => {
    onFaceChange(face.id, face.name);
  };

  const handleCustomApply = () => {
    if (customId.trim()) {
      onFaceChange(customId.trim(), customName.trim() || "Custom Avatar");
      setShowCustomInput(false);
      setCustomId("");
      setCustomName("");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors">
          <User className="w-4 h-4" />
          <span>{currentName}</span>
          <ChevronDown className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-64 max-h-80 overflow-y-auto bg-background border border-border z-50"
        align="start"
      >
        {showCustomInput ? (
          <div className="p-3 space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Face ID</label>
              <Input
                placeholder="Enter Simli Face ID"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Name (optional)</label>
              <Input
                placeholder="Avatar name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCustomInput(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCustomApply}
                disabled={!customId.trim()}
                className="flex-1"
              >
                Apply
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Preset Avatars
            </div>
            {SIMLI_PRESET_FACES.map((face) => (
              <DropdownMenuItem
                key={face.id}
                onClick={() => handlePresetSelect(face)}
                className={`cursor-pointer ${currentFaceId === face.id ? "bg-accent" : ""}`}
              >
                <User className="w-4 h-4 mr-2 opacity-60" />
                {face.name}
                {currentFaceId === face.id && (
                  <span className="ml-auto text-xs text-primary">✓</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowCustomInput(true)}
              className="cursor-pointer"
            >
              <span className="text-primary">+ Enter Custom Face ID</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default FaceSelector;
