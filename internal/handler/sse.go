package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
)

// SSEWriter wraps http.ResponseWriter to stream Server-Sent Events.
type SSEWriter struct {
	w       http.ResponseWriter
	flusher http.Flusher
}

// NewSSEWriter sets standard SSE response headers and returns an SSEWriter.
func NewSSEWriter(w http.ResponseWriter) (*SSEWriter, error) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		return nil, errors.New("streaming unsupported")
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	return &SSEWriter{w: w, flusher: flusher}, nil
}

// Send sends an event name and JSON-encoded data payload to the client.
func (s *SSEWriter) Send(event string, data any) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}
	if event == "" {
		event = "message"
	}
	_, err = fmt.Fprintf(s.w, "event: %s\ndata: %s\n\n", event, payload)
	if err != nil {
		return err
	}
	s.flusher.Flush()
	return nil
}
