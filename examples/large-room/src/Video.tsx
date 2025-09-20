import { RemoteVideoStream, RoomSubscription } from '@skyway-sdk/room';
import { FC, useEffect, useMemo, useRef } from 'react';

interface WindowAndAudioAndParticipantsInfo {
  topDiff: number;
  leftDiff: number;
  width: number;
  height: number;
  borderRed: number;
  borderGreen: number;
  borderBlue: number;
  borderAlpha: number;
  borderAlphaValueBasedVoice: number;
  theta: number;
  widthInCaseOfChange: number;
  isSpeaking: boolean;
  transcript: string;
  gazeStatus: string;
}

// --- Global Variables（以下すべてuseStateで管理したいが，やり方が分かっていないので，保留） ---
const scrollMyX = window.scrollX; // 自分自身（参加者側）のスクロール位置（X座標）
// const moveWidths: number[] = []; // ビデオウィンドウの大きさの移動平均を計算するためのリスト
// const moveBorderAlphas: number[] = []; // ビデオウィンドウの枠の色の透明度の移動平均を計算するためのリスト
// const isSpeaking = false; // 発話状態か否か
// const borderAlphaValueBasedVoice = AppConstants.BORDER_ALPHA_MIN; // 発話タイミングに基づく，枠の色の透明度変化を表す値

// --- Component Logic ---
export const Video: FC<{
  subscription: RoomSubscription<RemoteVideoStream>;
  windowInfo?: WindowAndAudioAndParticipantsInfo;
  participantNum: number;
  participantAllNums: number;
  windowMax: number;
}> = ({
  subscription,
  windowInfo,
  participantNum,
  participantAllNums,
  windowMax,
}) => {
  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- Effects ---
  useEffect(() => {
    if (videoRef?.current && subscription.stream) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      videoRef.current!.srcObject = new MediaStream([
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        subscription.stream!.track,
      ]);
    }
  }, [videoRef?.current, subscription.stream]);

  // --- Memos ---
  const style: React.CSSProperties = useMemo(() => {
    console.log('Window Info:' + windowInfo);
    // WindowInfoが存在しない場合には，デフォルトスタイルを適用
    if (!windowInfo) {
      return {};
    }

    // eslint-disable-next-line
    // console.log("participantNum:" + participantNum); // デバッグ用

    // windowInfoから動的にスタイル生成
    return {
      position: 'absolute',
      width: windowInfo?.width,
      top: `${
        0 +
        window.screen.height / 2 -
        windowInfo.height / 2 +
        windowInfo.topDiff
      }px`,
      left: `${
        window.screenLeft +
        scrollMyX +
        window.screen.width / 2 -
        windowInfo.width / 2 +
        windowInfo.leftDiff +
        (windowMax + 50) * (participantNum + 1 - (participantAllNums + 1) / 2) // ウィンドウを中央揃えにする
      }px`,
      border: `10px solid rgba(${windowInfo?.borderRed}, ${windowInfo?.borderGreen}, ${windowInfo?.borderBlue}, ${windowInfo.borderAlpha})`,
    };
    // }
  }, [windowInfo]);

  const switchEncodingSetting = async () => {
    if (subscription.preferredEncoding === 'high') {
      subscription.changePreferredEncoding('low');
    } else if (subscription.preferredEncoding === 'low') {
      subscription.changePreferredEncoding('high');
    }
  };

  return (
    <div>
      <video
        muted
        autoPlay
        playsInline
        ref={videoRef}
        onClick={switchEncodingSetting}
        style={style}
      />
    </div>
  );
};
