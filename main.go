package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	_ "github.com/mattn/go-sqlite3"
)

var db *sql.DB

type OpType int

const (
	OP_INVALID OpType = iota
	OP_SELECT
	OP_EXEC
)

type Args []interface{}
type QueryType string

const (
	QUERY_SELECT QueryType = "select"
	QUERY_EXEC   QueryType = "exec"
)

type SQLQuery struct {
	Query string `json:"sql"`
	Args  Args   `json:"args"`
}

type SQLQueryResult struct {
	Type QueryType                `json:"query_type"`
	Data []map[string]interface{} `json:"data"`
}

type SQLExecResult struct {
	Type         QueryType `json:"query_type"`
	LastInsertID int64     `json:"last_insert_id"`
	RowsAffected int64     `json:"rows_affected"`
}

type SQLError struct {
	Message string `json:"message"`
	Code    int    `json:"code"`
}

type Response struct {
	Result any       `json:"data,omitempty"`
	Error  *SQLError `json:"error,omitempty"`
	Ok     bool      `json:"ok"`
}

func init() {
	var err error
	db, err = sql.Open("sqlite3", "./db.sqlite3")
	if err != nil {
		log.Fatal(err)
	}
}

func main() {
	defer db.Close()
	router := chi.NewRouter()

	router.Use(cors.AllowAll().Handler)

	router.Post("/query", queryHandler)
	router.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		encodeJSON(w, Response{
			Ok: true,
		})
		return
	})

	log.Println("Listening on :8080")
	if err := http.ListenAndServe(":8080", router); err != nil {
		log.Fatal(err)
	}
}

func queryHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	body := new(SQLQuery)
	if err := decodeJSON(r, body); err != nil || body.Query == "" {
		encodeJSON(w, Response{
			Error: &SQLError{
				Message: err.Error(),
				Code:    http.StatusBadRequest,
			},
			Ok: false,
		})
		return
	}

	opType := getOpType(body.Query)
	stmt, err := db.Prepare(body.Query)
	if err != nil {
		encodeJSON(w, Response{
			Ok: false,
			Error: &SQLError{
				Message: err.Error(),
				Code:    http.StatusInternalServerError,
			},
		})
		return
	}

	if opType == OP_SELECT {
		result := []map[string]interface{}{}
		rows, err := stmt.Query(body.Args...)
		if err != nil {
			encodeJSON(w, Response{
				Ok: false,
				Error: &SQLError{
					Message: err.Error(),
					Code:    http.StatusInternalServerError,
				},
			})
			return
		}
		defer rows.Close()

		fields, err := rows.Columns()
		if err != nil {
			encodeJSON(w, Response{
				Ok: false,
				Error: &SQLError{
					Message: err.Error(),
					Code:    http.StatusInternalServerError,
				},
			})
			return
		}

		for rows.Next() {
			scans := make([]interface{}, len(fields))
			row := make(map[string]interface{})

			for i := range scans {
				scans[i] = &scans[i]
			}

			err := rows.Scan(scans...)
			if err != nil {
				encodeJSON(w, Response{
					Ok: false,
					Error: &SQLError{
						Message: err.Error(),
						Code:    http.StatusInternalServerError,
					},
				})
				return
			}

			for i, v := range scans {
				var value interface{}
				if v != nil {
					value = v
				}
				row[fields[i]] = value
			}

			result = append(result, row)
		}

		data := new(SQLQueryResult)
		data.Data = result
		data.Type = QUERY_SELECT

		encodeJSON(w, Response{
			Result: data,
			Ok:     true,
		})
		return
	}

	if opType == OP_EXEC {
		result, err := stmt.Exec(body.Args...)
		if err != nil {
			encodeJSON(w, Response{
				Ok: false,
				Error: &SQLError{
					Message: err.Error(),
					Code:    http.StatusInternalServerError,
				},
			})
			return
		}

		data := new(SQLExecResult)
		data.LastInsertID, _ = result.LastInsertId()
		data.RowsAffected, _ = result.RowsAffected()
		data.Type = QUERY_EXEC

		encodeJSON(w, Response{
			Result: map[string]any{"data": data, "type": QUERY_EXEC},
			Ok:     true,
		})
		return
	}

	encodeJSON(w, Response{
		Error: &SQLError{
			Message: "Invalid SQL",
			Code:    http.StatusBadRequest,
		},
		Ok: false,
	})
	return
}

func getOpType(sql string) OpType {
	firstWord := strings.Split(sql, " ")[0]

	switch strings.ToLower(firstWord) {
	case "select":
		return OP_SELECT
	case "insert",
		"update",
		"delete",
		"create",
		"drop",
		"alter",
		"truncate",
		"replace",
		"begin",
		"commit",
		"rollback":
		// not a real solution, but good enough for now
		return OP_EXEC
	default:
		return OP_INVALID
	}
}

func decodeJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

func encodeJSON(w http.ResponseWriter, v Response) error {
	code := 200
	if v.Error != nil {
		code = v.Error.Code
	}
	w.WriteHeader(code)
	return json.NewEncoder(w).Encode(v)
}
