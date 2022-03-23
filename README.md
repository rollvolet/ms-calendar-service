# MS calendar service

Microservice to interact with Microsoft 365 Calendar using [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/api/overview?view=graph-rest-1.0) [on behalf of the user](https://docs.microsoft.com/en-us/graph/auth-v2-user).

## Getting started
### Adding the service to your stack
Add the following snippet to your `docker-compose.yml` to include the files service in your project.

```yml
ms-calendar:
  image: rollvolet/ms-calendar-service
```

Add rules to the `dispatcher.ex` to dispatch requests to the files service. E.g.

```elixir
  define_accept_types [
    json: [ "application/json", "application/vnd.api+json" ],
    html: [ "text/html", "application/xhtml+html" ],
    any: [ "*/*" ]
  ]

  define_layers [ :static, :services ]
```

_TODO_

## Reference
### Configuration
The following enviroment variables can be set on the service:

_TODO_

### Model
_TODO_

### API
_TODO_
