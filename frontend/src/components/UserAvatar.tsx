import { useState } from "react";
import { getInitials, pickUserAvatarSrc } from "../utils/avatar";
import "./UserAvatar.css";

type UserAvatarSize = "sm" | "md" | "lg";

type UserAvatarProps = {
  name?: string | null;
  avatarUrl?: string | null;
  productImageUrl?: string | null;
  size?: UserAvatarSize;
  className?: string;
  role?: "buyer" | "seller" | "deliverer" | string;
};

const SIZE_CLASS: Record<UserAvatarSize, string> = {
  sm: "user-avatar--sm",
  md: "user-avatar--md",
  lg: "user-avatar--lg",
};

export default function UserAvatar({
  name,
  avatarUrl,
  productImageUrl,
  size = "md",
  className = "",
  role,
}: UserAvatarProps) {
  const src = pickUserAvatarSrc(avatarUrl, { productImageUrl });
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  const initials = getInitials(name);

  return (
    <div
      className={`user-avatar ${SIZE_CLASS[size]} ${className}`.trim()}
      title={name || undefined}
      aria-hidden={!name}
    >
      {showImage ? (
        <img
          src={src!}
          alt=""
          className="user-avatar__img"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="user-avatar__initials" aria-hidden="true">
          {initials}
        </span>
      )}
      {role && (
        <div className={`user-avatar__badge ${role}`} />
      )}
    </div>
  );
}
