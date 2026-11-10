import { cn } from "@/lib/utils";

/**
 * A model maker's logo from /public/models, at text size. `mono` logos are
 * single-colour (currentColor) SVGs, which can't take a colour through <img>,
 * so they're painted as a mask over the current text colour instead.
 */
export function ModelLogo({
  src,
  mono,
  className,
}: {
  src: string;
  mono?: boolean;
  className?: string;
}) {
  if (mono) {
    return (
      <span
        aria-hidden
        className={cn("inline-block size-3.5 bg-current", className)}
        style={{
          maskImage: `url(${src})`,
          WebkitMaskImage: `url(${src})`,
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
      />
    );
  }
  return (
    <img src={src} alt="" aria-hidden width={14} height={14} className={cn("size-3.5", className)} />
  );
}
