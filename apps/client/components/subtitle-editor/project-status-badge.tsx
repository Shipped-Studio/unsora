import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

/** Only shown while a project still needs attention; finished ones get none. */
export function ProjectStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "draft":
      return <Badge variant="outline">Not transcribed</Badge>;
    case "failed":
      return <Badge variant="destructive">Transcription failed</Badge>;
    case "completed":
      return null;
    default:
      return (
        <Badge variant="secondary">
          <Spinner aria-hidden />
          Transcribing
        </Badge>
      );
  }
}
