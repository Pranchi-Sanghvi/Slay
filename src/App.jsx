import BookingPage from "./BookingPage";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

function App() {
  const [session, setSession] = useState(null);
  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [clients, setClients] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("overview");

  // Controls the initial Owner / Client selection screen
  const [userType, setUserType] = useState(null);

  useEffect(() => {
    async function initialize() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);

      if (session) {
        await loadDashboard(session.user.id);
      }

      setLoading(false);
    }

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);

      if (newSession) {
        await loadDashboard(newSession.user.id);
      } else {
        setBusiness(null);
        setServices([]);
        setProviders([]);
        setClients([]);
        setBookings([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadDashboard(userId) {
    setLoading(true);
    setError("");

    const { data: membership, error: membershipError } = await supabase
      .from("business_members")
      .select("business_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    if (!membership) {
      setError("No business is associated with this account.");
      setLoading(false);
      return;
    }

    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", membership.business_id)
      .single();

    if (businessError) {
      setError(businessError.message);
      setLoading(false);
      return;
    }

    setBusiness(businessData);

    const { data: servicesData, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", membership.business_id)
      .eq("is_active", true)
      .order("name");

    if (servicesError) {
      setError(servicesError.message);
      setLoading(false);
      return;
    }

    const { data: providersData, error: providersError } = await supabase
      .from("providers")
      .select("*")
      .eq("business_id", membership.business_id)
      .eq("is_active", true)
      .order("name");

    if (providersError) {
      setError(providersError.message);
      setLoading(false);
      return;
    }

    const { data: clientsData, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .eq("business_id", membership.business_id)
      .order("created_at", { ascending: false });

    if (clientsError) {
      setError(clientsError.message);
      setLoading(false);
      return;
    }

    const { data: bookingsData, error: bookingsError } = await supabase
      .from("bookings")
      .select(
        `
        *,
        services (
          name,
          duration_minutes,
          price
        ),
        providers (
          name
        ),
        clients (
          name,
          email,
          phone
        )
      `
      )
      .eq("business_id", membership.business_id)
      .order("start_time", { ascending: true });

    if (bookingsError) {
      setError(bookingsError.message);
      setLoading(false);
      return;
    }

    setServices(servicesData || []);
    setProviders(providersData || []);
    setClients(clientsData || []);
    setBookings(bookingsData || []);

    setLoading(false);
  }

  async function handleLogin(e) {
    e.preventDefault();

    setLoginLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }

    setLoginLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    setSession(null);
    setBusiness(null);
    setServices([]);
    setProviders([]);
    setClients([]);
    setBookings([]);
    setUserType(null);
    setEmail("");
    setPassword("");
    setError("");
  }

  async function updateBookingStatus(bookingId, status) {
    setError("");

    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", bookingId)
      .eq("business_id", business.id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadDashboard(session.user.id);
  }

  function getBookingDate(booking) {
    return new Date(booking.start_time).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function getBookingTime(booking) {
    return new Date(booking.start_time).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getTodayBookings() {
    const today = new Date();

    return bookings.filter((booking) => {
      const bookingDate = new Date(booking.start_time);

      return (
        bookingDate.getDate() === today.getDate() &&
        bookingDate.getMonth() === today.getMonth() &&
        bookingDate.getFullYear() === today.getFullYear()
      );
    });
  }

  function getUpcomingBookings() {
    const now = new Date();

    return bookings.filter(
      (booking) =>
        new Date(booking.start_time) >= now &&
        booking.status !== "cancelled"
    );
  }

  // Public booking pages
  if (window.location.pathname.startsWith("/booking/")) {
    return <BookingPage />;
  }

  if (loading) {
    return (
      <div className="page-center">
        <div className="loading-card">
          <h2>Loading Slay...</h2>
          <p>Preparing your business dashboard.</p>
        </div>
      </div>
    );
  }

  // If the user is not logged in and has not selected a role
  if (!session && !userType) {
    return (
      <div className="page-center">
        <div className="login-card role-selection-card">
          <div className="brand">slay</div>

          <h1>Welcome to Slay</h1>

          <p className="subtitle">
            How do you want to use Slay?
          </p>

          <div className="role-options">
            <button
              className="role-button"
              onClick={() => setUserType("owner")}
            >
              <span className="role-icon">○</span>

              <div>
                <strong>Business Owner</strong>
                <small>
                  Manage your business, bookings and clients
                </small>
              </div>
            </button>

            <button
              className="role-button"
              onClick={() => setUserType("client")}
            >
              <span className="role-icon">○</span>

              <div>
                <strong>Client</strong>
                <small>
                  Find a business and book an appointment
                </small>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Client business selection
  if (!session && userType === "client") {
    return (
      <div className="page-center">
        <div className="login-card client-selection-card">
          <div className="brand">slay</div>

          <h1>Book an appointment</h1>

          <p className="subtitle">
            Choose a business to continue.
          </p>

          <div className="business-options">
            <div className="business-option">
              <div>
                <strong>Glow & Go Salon</strong>
                <p>Ahmedabad</p>
              </div>

              <button
                className="primary-button"
                onClick={() =>
                  (window.location.href = "/booking/glow-and-go")
                }
              >
                Book Appointment
              </button>
            </div>

            <div className="business-option">
              <div>
                <strong>Elite Cuts Barber</strong>
                <p>Surat</p>
              </div>

              <button
                className="primary-button"
                onClick={() =>
                  (window.location.href = "/booking/elite-cuts")
                }
              >
                Book Appointment
              </button>
            </div>
          </div>

          <button
            className="back-button"
            onClick={() => setUserType(null)}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // Owner login
  if (!session && userType === "owner") {
    return (
      <div className="page-center">
        <div className="login-card">
          <div className="brand">slay</div>

          <h1>Business Owner Login</h1>

          <p className="subtitle">
            Manage appointments, clients and services in one place.
          </p>

          <form onSubmit={handleLogin}>
            <label>Email</label>

            <input
              type="email"
              placeholder="owner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label>Password</label>

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              className="primary-button"
              disabled={loginLoading}
            >
              {loginLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {error && <div className="error-box">{error}</div>}

          <div className="demo-box">
            <strong>Demo accounts</strong>
            <span>owner@glowandgo.demo</span>
            <span>owner@elitecuts.demo</span>
            <small>Password: Demo@12345</small>
          </div>

          <button
            className="back-button"
            onClick={() => {
              setUserType(null);
              setError("");
            }}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-center">
        <div className="error-box">{error}</div>
      </div>
    );
  }

  const todayBookings = getTodayBookings();
  const upcomingBookings = getUpcomingBookings();

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="brand">slay</div>
          <span className="topbar-subtitle">
            Booking management
          </span>
        </div>

        <div className="account-area">
          <div>
            <strong>{business?.name}</strong>
            <small>{session.user.email}</small>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="welcome">
          <div>
            <p className="eyebrow">BUSINESS DASHBOARD</p>
            <h1>{business?.name}</h1>
            <p>{business?.description}</p>
          </div>

          <div className="welcome-actions">
            <div className="published">
              <span></span>
              {business?.is_published
                ? "Booking page live"
                : "Draft"}
            </div>
          </div>
        </section>

        <nav className="dashboard-tabs">
          <button
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>

          <button
            className={activeTab === "bookings" ? "active" : ""}
            onClick={() => setActiveTab("bookings")}
          >
            Bookings
          </button>

          <button
            className={activeTab === "clients" ? "active" : ""}
            onClick={() => setActiveTab("clients")}
          >
            Clients
          </button>

          <button
            className={activeTab === "services" ? "active" : ""}
            onClick={() => setActiveTab("services")}
          >
            Services
          </button>
        </nav>

        {activeTab === "overview" && (
          <>
            <section className="stats-grid">
              <StatCard
                title="Today"
                value={todayBookings.length}
                description="Appointments today"
              />

              <StatCard
                title="Upcoming"
                value={upcomingBookings.length}
                description="Future appointments"
              />

              <StatCard
                title="Clients"
                value={clients.length}
                description="Total clients"
              />

              <StatCard
                title="Services"
                value={services.length}
                description="Active services"
              />
            </section>

            <section className="content-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Today's appointments</h2>
                    <p>Appointments scheduled for today</p>
                  </div>
                </div>

                {todayBookings.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">□</div>
                    <h3>No appointments today</h3>
                    <p>Your schedule is clear for today.</p>
                  </div>
                ) : (
                  <BookingList
                    bookings={todayBookings}
                    getBookingDate={getBookingDate}
                    getBookingTime={getBookingTime}
                    updateBookingStatus={updateBookingStatus}
                  />
                )}
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Team</h2>
                    <p>Active service providers</p>
                  </div>
                </div>

                {providers.length === 0 ? (
                  <p className="empty">No providers yet.</p>
                ) : (
                  <div className="provider-list">
                    {providers.map((provider) => (
                      <div className="provider-row" key={provider.id}>
                        <div className="avatar">
                          {provider.name.charAt(0)}
                        </div>

                        <div>
                          <strong>{provider.name}</strong>
                          <p>{provider.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === "bookings" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>All bookings</h2>
                <p>
                  Appointments belonging to {business?.name}
                </p>
              </div>
            </div>

            {bookings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">□</div>
                <h3>No bookings yet</h3>
                <p>
                  Bookings created through the public booking page
                  will appear here.
                </p>
              </div>
            ) : (
              <BookingList
                bookings={bookings}
                getBookingDate={getBookingDate}
                getBookingTime={getBookingTime}
                updateBookingStatus={updateBookingStatus}
              />
            )}
          </section>
        )}

        {activeTab === "clients" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Client CRM</h2>
                <p>
                  Customers who have booked with your business
                </p>
              </div>
            </div>

            {clients.length === 0 ? (
              <div className="empty-state">
                <h3>No clients yet</h3>
                <p>
                  Clients will appear here after their first booking.
                </p>
              </div>
            ) : (
              <div className="client-grid">
                {clients.map((client) => (
                  <div className="client-card" key={client.id}>
                    <div className="avatar">
                      {client.name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <strong>{client.name}</strong>
                      <p>{client.email}</p>
                      <p>{client.phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "services" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Services</h2>
                <p>Your available appointment services</p>
              </div>
            </div>

            {services.length === 0 ? (
              <p className="empty">No services yet.</p>
            ) : (
              <div className="service-list">
                {services.map((service) => (
                  <div className="service-row" key={service.id}>
                    <div>
                      <strong>{service.name}</strong>
                      <p>{service.description}</p>
                    </div>

                    <div className="service-meta">
                      <span>{service.duration_minutes} min</span>
                      <strong>₹{service.price}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function BookingList({
  bookings,
  getBookingDate,
  getBookingTime,
  updateBookingStatus,
}) {
  return (
    <div className="booking-list">
      {bookings.map((booking) => (
        <div className="booking-card" key={booking.id}>
          <div className="booking-main">
            <div className="booking-date">
              <strong>{getBookingDate(booking)}</strong>
              <span>{getBookingTime(booking)}</span>
            </div>

            <div className="booking-info">
              <strong>
                {booking.clients?.name || "Unknown client"}
              </strong>

              <p>
                {booking.services?.name || "Service"}
                {" · "}
                {booking.providers?.name || "Provider"}
              </p>

              <small>
                {booking.clients?.email || ""}
                {booking.clients?.phone
                  ? ` · ${booking.clients.phone}`
                  : ""}
              </small>
            </div>
          </div>

          <div className="booking-actions">
            <span className={`status ${booking.status}`}>
              {booking.status}
            </span>

            {booking.status === "pending" && (
              <button
                className="small-button"
                onClick={() =>
                  updateBookingStatus(booking.id, "confirmed")
                }
              >
                Confirm
              </button>
            )}

            {booking.status === "confirmed" && (
              <button
                className="small-button"
                onClick={() =>
                  updateBookingStatus(booking.id, "completed")
                }
              >
                Complete
              </button>
            )}

            {(booking.status === "pending" ||
              booking.status === "confirmed") && (
              <button
                className="small-button danger"
                onClick={() =>
                  updateBookingStatus(booking.id, "cancelled")
                }
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, value, description }) {
  return (
    <div className="stat-card">
      <p>{title}</p>
      <h2>{value}</h2>
      <span>{description}</span>
    </div>
  );
}

export default App;