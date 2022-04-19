# MS calendar service

Microservice to interact with Microsoft 365 Calendar using [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/api/overview?view=graph-rest-1.0) [on behalf of the user](https://docs.microsoft.com/en-us/graph/auth-v2-user).

## Getting started
### Adding the service to your stack
Add the following snippet to your `docker-compose.yml` to include the files service in your project.

```yml
ms-calendar:
  image: rollvolet/ms-calendar-service
```

Add rules to the `dispatcher.ex` to dispatch requests to the calendar service. The service only provides custom endpoints for write operations. It's the intention to dispatch read operations to mu-cl-resources (or mu-cache if in front of mu-cl-resources).

E.g.

```elixir
  define_accept_types [
    json: [ "application/json", "application/vnd.api+json" ],
    html: [ "text/html", "application/xhtml+html" ],
    any: [ "*/*" ]
  ]

  define_layers [ :static, :services ]

  post "/calendar-events/*path", %{ layer: :services, accept: %{ json: true } } do
    Proxy.forward conn, path, "http://ms-calendar/calendar-events/"
  end

  patch "/calendar-events/*path", %{ layer: :services, accept: %{ json: true } } do
    Proxy.forward conn, path, "http://ms-calendar/calendar-events/"
  end

  delete "/calendar-events/*path", %{ layer: :services, accept: %{ json: true } } do
    Proxy.forward conn, path, "http://ms-calendar/calendar-events/"
  end

  get "/calendar-events/:id/ms-event", %{ layer: :services, accept: %{ json: true } } do
    Proxy.forward conn, [], "http://ms-calendar/calendar-events/" <> id <> "/ms-event"
  end

  get "/calendar-events/*path", %{ layer: :services, accept: %{ json: true } } do
    Proxy.forward conn, path, "http://cache/calendar-events/"
  end
```


## Reference
### Configuration
The following enviroment variables can be set on the service. All are optional.

- **VISIT_START_HOUR**: Default start hour (int) for newly scheduled visit events (default: 17)
- **PLANNING_START_HOUR**: Default start hour (int) for newly scheduled planning events (default: 19)
- **CUSTOMER_VISIT_CALENDAR**: URI of the visit calendar (default: `http://data.rollvolet.be/calendars/88e92b1b-c3e2-4a2e-a7a4-d34aee6c7746`)
- **PLANNING_CALENDAR**: URI of the planning calendar (default: `http://data.rollvolet.be/calendars/0147d534-d7c2-49dc-bd8f-bb6951664017`)
- **SESSIONS_GRAPH**: URI in which session information is stored (default: `http://mu.semte.ch/graphs/sessions`)

### Model
#### Ontologies and prefixes
The data model is based on the data model of the [mu-file-service](https://github.com/mu-semtech/file-service) but contains a few additions.

| Prefix  | URI                                                       |
|---------|-----------------------------------------------------------|
| nfo     | http://www.semanticdesktop.org/ontologies/2007/03/22/nfo# |
| nie     | http://www.semanticdesktop.org/ontologies/2007/01/19/nie# |
| dct     | http://purl.org/dc/terms/                                 |
| dbpedia | http://dbpedia.org/ontology/                              |
| dossier | https://data.vlaanderen.be/ns/dossier#                    |

#### Calendar
##### Description
Calendar containing events. Dependending the type of the related resource (e.g. request, intervention, ...) events get scheduled in a specific calendar.

##### Class
`ncal:Calendar`

##### Properties
| Name  | Predicate        | Range        | Definition                            |
|-------|------------------|--------------|---------------------------------------|
| title | `nie:title`      | `xsd:string` | Title of the calendar                 |
| event | `ncal:component` | `ncal:Event` | Events that are part of this calendar |

#### Calendar-event
##### Description
Event scheduling work to be executed at the customer related to a specific phase in a case (e.g. request, intervention, ...)

##### Class
`ncal:Event`

##### Properties
| Name          | Predicate          | Range          | Definition                                                             |
|---------------|--------------------|----------------|------------------------------------------------------------------------|
| ms-identifier | `ncal:uid`         | `xsd:string`   | Identifier of the event in MS Calendar                                 |
| date          | `ncal:date`        | `xsd:date`     | Schedule date of the event                                             |
| subject       | `ncal:summary`     | `xsd:string`   | Subject of the event                                                   |
| description   | `ncal:description` | `xsd:string`   | Description of the event                                               |
| location      | `ncal:location`    | `xsd:string`   | Location of the event                                                  |
| url           | `ncal:url`         | `rdf:Resource` | URL to the event in the RKB application                                |
| phase         | `dct:subject`      | `rdf:Resource` | Phase in the case this event relates to (eg. intervention, order, ...) |
| source        | `dct:source`       | `xsd:string`   | System that is the source of the resource. Either `RKB` or `Access`    |


### API
_Note: unless specified otherwise, all requests to the MS Graph API are executed on behalf of the user. The access token is retrieved from the OAuth-session related to the user's mu-session in the triplestore._

#### POST /calendar-events
Create a new calendar event in the triplestore as well as in the MS Calendar.

##### Response
- `201 Created` in case the calendar-event is successfully created in the triplestore and MS Calendar
- `400 Bad Request` if the session header is missing

#### GET /calendar-events/:id/ms-event
Get info about the event scheduled in the MS Calendar for a given id. Useful to detect out-of-sync data with calendar-event in triplestore.

##### Response
- `200 OK` if the calendar-event is found in triplestore. The MS Calendar Event is returned in the response body. Note that the data might be null if the event cannot found in the MS Calendar.
- `404 Not Found` if the calendar-event cannot be found in the triplestore
- `409 Conflict` if the calendar-event is found in triplestore and MS Calendar but the dates on both entities don't match
- `400 Bad Request` if the session header is missing

Example response body on success:
```json
{
  "data": {
    "id":"AQMkADgzYjVkODBmLTk3YjItNDBLBCMUiqxsI1h6u6_QAAAgENAAAAQ4==",
    "type":"ms-events"
  }
}
```

#### PATCH /calendar-events/:id
Updates the calendar-event with the given id in the triplestore as well as in the MS Calendar.

##### Response
- `200 OK` if the calendar-event is successfully updated in triplestore as well as in the MS Calendar.
- `404 Not Found` if the calendar-event cannot be found in the triplestore
- `409 Conflict` if the calendar-event is found in triplestore, but doesn't have a reference to the MS Calendar (e.g. old events mastered by Access)
- `400 Bad Request` if the session header is missing


#### DELETE /calendar-events/:id
Deletes the calendar-event with the given id from the triplestore as well as from the MS Calendar (if any)

##### Response
- `204 No Content` if the calendar-event is successfully deleted
- `400 Bad Request` if the session header is missing


