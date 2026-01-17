import { Video, Mic, MonitorUp, LogOut, Circle } from "lucide-react";

interface ControlBarProps {
  isCameraOn: boolean;
  isMicOn: boolean;
  isRecording: boolean;
  recordingTime: number;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onShare: () => void;
  onLeave: () => void;
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
  recordingTime,
  onToggleCamera,
  onToggleMic,
  onShare,
  onLeave,
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
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleCamera}
          className={`control-button ${isCameraOn ? "control-button-active" : ""}`}
        >
          <Video className="w-6 h-6" />
        </button>
        <span className="text-xs text-muted-foreground">Cam</span>

        <button
          onClick={onToggleMic}
          className={`control-button ${isMicOn ? "control-button-active" : ""}`}
        >
          <Mic className="w-6 h-6" />
        </button>
        <span className="text-xs text-muted-foreground">Mic</span>

        <button onClick={onShare} className="control-button">
          <MonitorUp className="w-6 h-6" />
        </button>
        <span className="text-xs text-muted-foreground">Share</span>

        <button onClick={onLeave} className="control-button control-button-danger">
          <LogOut className="w-6 h-6" />
        </button>
        <span className="text-xs text-muted-foreground">Leave</span>
      </div>

      {/* Right spacer for balance */}
      <div className="w-32" />
    </div>
  );
};

export default ControlBar;