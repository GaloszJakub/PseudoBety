'use client';

interface Props { sport: string; size?: number; }

export default function SportIcon({ sport, size = 14 }: Props) {
  const marks: Record<string, React.ReactNode> = {
    football: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M12 3 L14 8 L19 8 M12 3 L10 8 L5 8 M5 8 L7 13 L5 17 M19 8 L17 13 L19 17 M7 13 L12 16 L17 13 M10 8 L12 11 L14 8 M5 17 L9 19 L12 16 M19 17 L15 19 L12 16" /></svg>,
    tennis: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M3 12 Q12 6 21 12 M3 12 Q12 18 21 12" /></svg>,
    basketball: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M3 12 H21 M12 3 V21 M5.5 5.5 Q9 9 9 12 Q9 15 5.5 18.5 M18.5 5.5 Q15 9 15 12 Q15 15 18.5 18.5" /></svg>,
    volleyball: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M12 3 Q4 8 4 16 M12 3 Q20 8 20 16 M3 12 Q12 14 21 12" /></svg>,
    hockey: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="14" rx="9" ry="3" /><path d="M3 14 L7 4 M21 14 L17 4 M7 4 L17 4" /></svg>,
    mma: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 4 L8 13 L4 14 L4 20 L11 20 L11 15 L17 13 L20 14 L20 8 L13 8 L13 4 Z" /></svg>,
    esport: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="11" rx="3" /><path d="M6 12 H10 M8 10 V14 M14 12 L16 12 M16 14 L18 14" /></svg>,
    horse: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 20 L4 14 Q4 8 10 8 L14 8 L17 5 L17 9 L20 11 L17 13 L17 20" /></svg>,
    handball: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M12 3 V21 M3 12 H21" /></svg>,
  };
  return <>{marks[sport] || marks.football}</>;
}
