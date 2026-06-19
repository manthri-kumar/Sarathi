// src/components/DestinationPicker.jsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useExploreSearchContext } from "../../pages/ExploreSearchContext";
import DestinationModal from "./DestinationModal";
import "./DestinationPicker.css";

const DestinationPicker = () => {
  const { t } = useTranslation();
  const { selectedCity } = useExploreSearchContext();
  const [open, setOpen] = useState(false);

  const label =
    selectedCity?.city || t("selectDestination") || "Select destination";

  return (
    <>
      <button
        type="button"
        className="dest-picker"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="dest-picker__pin" aria-hidden="true">📍</span>
        <span className="dest-picker__label">{label}</span>
        <span className="dest-picker__chev" aria-hidden="true">▾</span>
      </button>

      {open && <DestinationModal onClose={() => setOpen(false)} />}
    </>
  );
};

export default DestinationPicker;
