import React, { useEffect, useRef, useState } from "react";
import "../styles/dealer.css";

// 隐藏时间（毫秒）
const SHOW_DURATION = 3000;
const HIDE_DURATION = 500;

export default function Dealer() {
  const [isVisible, setIsVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [currentQuote, setCurrentQuote] = useState("");
  const [playerName, setPlayerName] = useState("");
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const handleDealerMessage = (event) => {
      const { quote, playerName } = event.detail || {};

      setPlayerName(playerName || "玩家");
      setCurrentQuote(quote || "");
      setIsVisible(true);
      setIsHiding(false);

      // 清除之前的定时器
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

      // SHOW_DURATION 后开始淡出
      hideTimerRef.current = setTimeout(() => {
        setIsHiding(true);
        // 淡出动画结束后彻底隐藏
        setTimeout(() => {
          setIsVisible(false);
          setIsHiding(false);
        }, HIDE_DURATION);
      }, SHOW_DURATION);
    };

    window.addEventListener("dealerMessage", handleDealerMessage);
    return () => {
      window.removeEventListener("dealerMessage", handleDealerMessage);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className={`dealer-overlay${isHiding ? " hiding" : ""}`}>
      <div className="dealer-container">
        <div className="dealer-speech">
          <div className="dealer-name">{playerName}</div>
          <div className="dealer-quote">"{currentQuote}"</div>
        </div>
      </div>
    </div>
  );
}
