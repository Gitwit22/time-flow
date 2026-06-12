import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface IdleWarningModalProps {
  open: boolean;
  onStaySignedIn: () => void;
}

export function IdleWarningModal({ open, onStaySignedIn }: IdleWarningModalProps) {
  return (
    <Dialog open={open}>
      {/* Prevent closing by clicking the backdrop — the user must choose explicitly. */}
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Your session will expire soon</DialogTitle>
          <DialogDescription>
            You have been inactive. You will be signed out automatically in a few minutes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onStaySignedIn}>Stay signed in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
