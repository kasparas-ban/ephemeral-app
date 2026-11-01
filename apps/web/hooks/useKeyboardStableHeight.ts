import { useEffect, useState } from "react";

import { useAtomValue } from "jotai";

import { hasOnScreenKeyboardAtom } from "@/stores/viewport";

// Window height at mount, ignoring height-only resizes on touch devices: the
// keyboard and system bars cause those, and Android briefly resizes the window
// while the keyboard closes.
export default function useKeyboardStableHeight() {
  const hasOnScreenKeyboard = useAtomValue(hasOnScreenKeyboardAtom);
  const [height, setHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    let width = window.innerWidth;
    const onResize = () => {
      if (hasOnScreenKeyboard && window.innerWidth === width) return;
      width = window.innerWidth;
      setHeight(window.innerHeight);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [hasOnScreenKeyboard]);

  return height;
}
