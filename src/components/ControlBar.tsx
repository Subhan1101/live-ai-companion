import { Video, Mic, MonitorUp, Phone, PhoneOff, Circle, Camera, MonitorOff, Hand } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

interface ControlBarProps {
  isCameraOn: boolean;
  isMicOn: boolean;
  isRecording: boolean;
  isCallActive: boolean;
  isScreenSharing: boolean;
  isBSLEnabled: boolean;
  isBSLLoading?: boolean;
  recordingTime: number;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onShare: () => void;
  onCaptureScreen: () => void;
  onToggleCall: () => void;
  onToggleBSL: () => void;
}

const formatTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const ControlBar = ({
  isCameraOn,
  isMicOn,
  isRecording,
  isCallActive,
  isScreenSharing,
  isBSLEnabled,
  isBSLLoading = false,
  recordingTime,
  onToggleCamera,
  onToggleMic,
  onShare,
  onCaptureScreen,
  onToggleCall,
  onToggleBSL,
}: ControlBarProps) => {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      {/* Recording indicator */}
      <div className="flex items-center gap-3 bg-card rounded-full px-4 py-2 shadow-card">
        <div className={`w-3 h-3 rounded-full ${isRecording ? "bg-destructive animate-pulse" : "bg-muted-foreground"}`}>
          <Circle className="w-3 h-3" fill="currentColor" />
        </div>
        <span className="font-mono text-sm font-medium">{formatTime(recordingTime)}</span>
      </div>

      {/* Main controls */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center">
          <button
            onClick={onToggleCamera}
            className={`control-button ${isCameraOn ? "control-button-active" : ""}`}
          >
            <Video className="w-5 h-5" />
          </button>
          <span className="text-xs text-muted-foreground mt-1">Cam</span>
        </div>

        <div className="flex flex-col items-center">
          <button
            onClick={onToggleMic}
            className={`control-button ${isMicOn ? "control-button-active" : ""}`}
          >
            <Mic className="w-5 h-5" />
          </button>
          <span className="text-xs text-muted-foreground mt-1">Mic</span>
        </div>

        <div className="flex flex-col items-center">
          <button 
            onClick={onShare} 
            className={`control-button ${isScreenSharing ? "control-button-active" : ""}`}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
          </button>
          <span className="text-xs text-muted-foreground mt-1">{isScreenSharing ? "Stop" : "Share"}</span>
        </div>

        {/* Capture screen button - only visible when sharing */}
        {isScreenSharing && (
          <div className="flex flex-col items-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={onCaptureScreen} 
                    className="control-button control-button-active"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Auto-capturing every 15s</p>
                  <p className="text-xs text-muted-foreground">⌘/Ctrl+Shift+S for instant capture</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-xs text-muted-foreground mt-1">Auto ✓</span>
          </div>
        )}

        {/* BSL toggle button */}
        <div className="flex flex-col items-center">
          <button 
            onClick={onToggleBSL} 
            className={`control-button ${isBSLEnabled ? "control-button-active" : ""}`}
            title="Enable British Sign Language mode"
            disabled={isBSLLoading}
          >
            <Hand className={`w-5 h-5 ${isBSLLoading ? "animate-pulse" : ""}`} />
          </button>
          <span className="text-xs text-muted-foreground mt-1">BSL</span>
        </div>

        {/* Call toggle button */}
        <div className="flex flex-col items-center ml-2">
          <button 
            onClick={onToggleCall} 
            className={`control-button ${isCallActive ? "control-button-danger" : "control-button-success"}`}
          >
            {isCallActive ? <PhoneOff className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
          </button>
          <span className="text-xs text-muted-foreground mt-1">{isCallActive ? "End" : "Call"}</span>
        </div>
      </div>

      {/* Right spacer for balance */}
      <div className="w-32" />
    </div>
  );
};

export default ControlBar;