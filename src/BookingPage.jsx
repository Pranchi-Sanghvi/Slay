import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

function BookingPage() {
  const slug = window.location.pathname.split("/booking/")[1];

  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);

  const [selectedService, setSelectedService] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const today = useMemo(() => {
    const date = new Date();
    return date.toISOString().split("T")[0];
  }, []);

  useEffect(() => {
    loadBusiness();
  }, [slug]);

  async function loadBusiness() {
    setLoading(true);
    setError("");

    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (businessError) {
      setError("Business not found.");
      setLoading(false);
      return;
    }

    setBusiness(businessData);

    const { data: servicesData, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", businessData.id)
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
      .eq("business_id", businessData.id)
      .eq("is_active", true)
      .order("name");

    if (providersError) {
      setError(providersError.message);
      setLoading(false);
      return;
    }

    setServices(servicesData || []);
    setProviders(providersData || []);

    if (servicesData?.length) {
      setSelectedService(servicesData[0].id);
    }

    if (providersData?.length) {
      setSelectedProvider(providersData[0].id);
    }

    setLoading(false);
  }

  async function loadSlots() {
    if (!selectedService || !selectedProvider || !selectedDate) {
      setSlots([]);
      return;
    }

    setLoadingSlots(true);
    setError("");
    setSelectedSlot("");

    const { data, error: slotsError } = await supabase.rpc(
      "get_available_slots",
      {
        p_business_slug: slug,
        p_service_id: selectedService,
        p_provider_id: selectedProvider,
        p_date: selectedDate,
      }
    );

    if (slotsError) {
      setError(slotsError.message);
      setSlots([]);
    } else {
      setSlots(data || []);
    }

    setLoadingSlots(false);
  }

  useEffect(() => {
    loadSlots();
  }, [selectedService, selectedProvider, selectedDate]);

  function formatSlot(slotStart) {
    return new Date(slotStart).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatPrice(price) {
    return `₹${Number(price).toLocaleString("en-IN")}`;
  }

  async function handleBooking(e) {
    e.preventDefault();

    if (!selectedSlot) {
      setError("Please select an available time.");
      return;
    }

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError("Please fill in your name, email and phone.");
      return;
    }

    setBooking(true);
    setError("");
    setSuccess("");

    const { error: bookingError } = await supabase.rpc(
      "create_public_booking",
      {
        p_business_slug: slug,
        p_service_id: selectedService,
        p_provider_id: selectedProvider,
        p_start_time: selectedSlot,
        p_client_name: name.trim(),
        p_client_email: email.trim(),
        p_client_phone: phone.trim(),
        p_notes: notes.trim() || null,
      }
    );

    if (bookingError) {
      setError(bookingError.message);
      setBooking(false);

      // Refresh availability in case another customer booked it.
      await loadSlots();

      return;
    }

    setSuccess(
      `Your appointment has been confirmed for ${new Date(
        selectedSlot
      ).toLocaleString()}.`
    );

    setSelectedSlot("");
    setName("");
    setEmail("");
    setPhone("");
    setNotes("");

    await loadSlots();

    setBooking(false);
  }

  if (loading) {
    return (
      <div className="booking-page">
        <div className="booking-card loading-card-public">
          <h2>Loading...</h2>
          <p>Preparing the booking page.</p>
        </div>
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="booking-page">
        <div className="booking-card">
          <div className="brand">slay</div>
          <h1>Business not found</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const currentService = services.find(
    (service) => service.id === selectedService
  );

  return (
    <div className="booking-page">
      <div className="booking-container">
        <header className="booking-header">
          <div className="brand">slay</div>

          <div className="live-badge">
            <span></span>
            Online booking
          </div>
        </header>

        <section className="business-hero">
          <div>
            <p className="eyebrow">BOOK AN APPOINTMENT</p>

            <h1>{business.name}</h1>

            <p>{business.description}</p>

            <div className="business-info">
              <span>{business.address}</span>
              <span>{business.phone}</span>
            </div>
          </div>
        </section>

        <div className="booking-layout">
          <main className="booking-card">
            <div className="step">
              <div className="step-number">1</div>

              <div className="step-content">
                <h2>Choose a service</h2>

                <div className="service-options">
                  {services.map((service) => (
                    <button
                      type="button"
                      key={service.id}
                      className={`service-option ${
                        selectedService === service.id ? "selected" : ""
                      }`}
                      onClick={() => {
                        setSelectedService(service.id);
                        setSelectedSlot("");
                      }}
                    >
                      <div>
                        <strong>{service.name}</strong>
                        <span>
                          {service.duration_minutes} minutes
                        </span>
                      </div>

                      <strong>{formatPrice(service.price)}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-number">2</div>

              <div className="step-content">
                <h2>Choose a provider</h2>

                <div className="provider-options">
                  {providers.map((provider) => (
                    <button
                      type="button"
                      key={provider.id}
                      className={`provider-option ${
                        selectedProvider === provider.id ? "selected" : ""
                      }`}
                      onClick={() => {
                        setSelectedProvider(provider.id);
                        setSelectedSlot("");
                      }}
                    >
                      <div className="provider-avatar">
                        {provider.name.charAt(0)}
                      </div>

                      <div>
                        <strong>{provider.name}</strong>
                        <span>{provider.email}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-number">3</div>

              <div className="step-content">
                <h2>Choose a date</h2>

                <input
                  className="date-input"
                  type="date"
                  min={today}
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlot("");
                  }}
                />

                {selectedDate && (
                  <div className="slots-area">
                    <h3>Available times</h3>

                    {loadingSlots ? (
                      <p className="muted">Checking availability...</p>
                    ) : slots.length === 0 ? (
                      <p className="muted">
                        No available times for this date.
                      </p>
                    ) : (
                      <div className="slot-grid">
                        {slots.map((slot) => (
                          <button
                            type="button"
                            key={slot.slot_start}
                            className={`slot ${
                              selectedSlot === slot.slot_start
                                ? "selected"
                                : ""
                            }`}
                            onClick={() =>
                              setSelectedSlot(slot.slot_start)
                            }
                          >
                            {formatSlot(slot.slot_start)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <form className="step" onSubmit={handleBooking}>
              <div className="step-number">4</div>

              <div className="step-content">
                <h2>Your details</h2>

                <div className="form-grid">
                  <div>
                    <label>Full name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      required
                    />
                  </div>

                  <div>
                    <label>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label>Phone</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                    />
                  </div>

                  <div>
                    <label>Notes</label>
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                {error && <div className="error-box">{error}</div>}

                {success && (
                  <div className="success-box">{success}</div>
                )}

                <button
                  className="confirm-button"
                  disabled={booking || !selectedSlot}
                >
                  {booking ? "Confirming..." : "Confirm appointment"}
                </button>
              </div>
            </form>
          </main>

          <aside className="booking-summary">
            <p className="eyebrow">YOUR APPOINTMENT</p>

            <h2>{currentService?.name || "Select a service"}</h2>

            {currentService && (
              <>
                <div className="summary-row">
                  <span>Duration</span>
                  <strong>
                    {currentService.duration_minutes} min
                  </strong>
                </div>

                <div className="summary-row">
                  <span>Price</span>
                  <strong>{formatPrice(currentService.price)}</strong>
                </div>
              </>
            )}

            <div className="summary-divider"></div>

            <div className="summary-row">
              <span>Provider</span>
              <strong>
                {providers.find((p) => p.id === selectedProvider)?.name ||
                  "Not selected"}
              </strong>
            </div>

            <div className="summary-row">
              <span>Date</span>
              <strong>{selectedDate || "Not selected"}</strong>
            </div>

            <div className="summary-row">
              <span>Time</span>
              <strong>
                {selectedSlot ? formatSlot(selectedSlot) : "Not selected"}
              </strong>
            </div>
          </aside>
        </div>

        <footer className="booking-footer">
          Powered by <strong>slay</strong>
        </footer>
      </div>
    </div>
  );
}

export default BookingPage;