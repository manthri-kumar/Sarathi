import React from "react";

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user"));

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020402",
        color: "white",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Poppins",
      }}
    >
      <div
        style={{
          background: "#0b0f0b",
          padding: "40px",
          borderRadius: "20px",
          boxShadow: "0 0 40px rgba(170,255,0,0.15)",
          textAlign: "center",
          width: "350px",
        }}
      >
        {/* PROFILE IMAGE */}
        <img
          src={
            user?.picture ||
            "https://cdn-icons-png.flaticon.com/512/149/149071.png"
          }
          alt="profile"
          style={{
            width: "90px",
            height: "90px",
            borderRadius: "50%",
            objectFit: "cover",
            marginBottom: "15px",
            border: "3px solid #b6ff00",
          }}
        />

        {/* NAME */}
        <h2 style={{ marginBottom: "5px" }}>
          {user?.username || "User"} 👋
        </h2>

        {/* EMAIL */}
        <p style={{ color: "#aaa", fontSize: "14px" }}>
          {user?.email}
        </p>

        {/* LOGOUT BUTTON */}
        <button
          onClick={handleLogout}
          style={{
            marginTop: "25px",
            width: "100%",
            padding: "12px",
            background: "linear-gradient(90deg, #b6ff00, #7fff00)",
            border: "none",
            borderRadius: "10px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default Dashboard;